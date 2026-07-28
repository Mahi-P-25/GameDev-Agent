import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { selectContext } from './ContextSelector';
import { buildPrompt } from './PromptBuilder';
import { selectModel } from './ModelRouter';
import { parseResponse, convertToChanges, ResponseParserError } from './ResponseParser';
import { validateChanges } from './DiffValidator';
import { verifyChanges } from './VerificationPipeline';
import { shouldRetry, buildRetryPrompt } from './RetryStrategy';
import { scanProject } from '../scanner';
import type { ProjectContext } from '../types';
import type { Change, ChangeResult } from '../change-types';
import type { PipelineReport, PipelineContext } from './types';

function createTestProject(rootDir: string): void {
  mkdirSync(join(rootDir, 'src'), { recursive: true });
  writeFileSync(join(rootDir, 'package.json'), JSON.stringify({
    name: 'intelligence-test',
    version: '1.0.0',
    dependencies: { three: '^0.160.0' },
    devDependencies: { typescript: '^5.3.0', vite: '^5.0.0' },
    scripts: { build: 'vite build', dev: 'vite', test: 'echo ok' },
    main: 'src/main.ts',
  }), 'utf-8');
  writeFileSync(join(rootDir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2020', module: 'ESNext', moduleResolution: 'bundler', strict: true },
    include: ['src'],
  }), 'utf-8');
  writeFileSync(join(rootDir, 'src', 'main.ts'), [
    'import * as THREE from "three";',
    'import { createScene } from "./scene";',
    '',
    'const scene = createScene();',
    'const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);',
    'const renderer = new THREE.WebGLRenderer();',
    'renderer.setSize(800, 600);',
    'document.body.appendChild(renderer.domElement);',
    '',
    'camera.position.z = 5;',
    '',
    'function animate() {',
    '  requestAnimationFrame(animate);',
    '  renderer.render(scene, camera);',
    '}',
    'animate();',
  ].join('\n'), 'utf-8');
  writeFileSync(join(rootDir, 'src', 'scene.ts'), [
    'import { Scene, Color } from "three";',
    '',
    'export function createScene(): Scene {',
    '  const scene = new Scene();',
    '  scene.background = new Color(0x111122);',
    '  return scene;',
    '}',
  ].join('\n'), 'utf-8');
  mkdirSync(join(rootDir, 'src', 'managers'), { recursive: true });
  writeFileSync(join(rootDir, 'src', 'managers', 'GameManager.ts'), [
    'import * as THREE from "three";',
    '',
    'export class GameManager {',
    '  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {}',
    '}',
  ].join('\n'), 'utf-8');
}

let tmpDir: string;
let context: ProjectContext;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'nova-intel-test-'));
  createTestProject(tmpDir);
  context = await scanProject(tmpDir);
});

afterAll(() => {
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* windows */ }
});

// ─── ContextSelector ────────────────────────────────────────────────────

describe('ContextSelector', () => {
  it('selects files matching request keywords', () => {
    const selected = selectContext(context, 'Add OrbitControls');
    expect(selected.files.length).toBeGreaterThan(0);
    const filePaths = selected.files.map((f) => f.path);
    expect(filePaths.some((p) => p.includes('main'))).toBe(true);
  });

  it('includes architecture summary', () => {
    const selected = selectContext(context, 'Add OrbitControls');
    expect(selected.architecture.length).toBeGreaterThan(0);
    expect(selected.architecture).toContain('Pattern');
  });

  it('includes coding conventions', () => {
    const selected = selectContext(context, 'Add OrbitControls');
    expect(selected.conventions.length).toBeGreaterThan(0);
    expect(selected.conventions).toContain('Language');
  });

  it('includes import graph for top files', () => {
    const selected = selectContext(context, 'Add OrbitControls');
    expect(selected.importsGraph.length).toBeGreaterThan(0);
    expect(selected.importsGraph).toContain('three');
  });

  it('returns file contents that can be read', () => {
    const selected = selectContext(context, 'Modify scene setup');
    expect(selected.files.length).toBeGreaterThan(0);
    for (const f of selected.files) {
      expect(f.content.length).toBeGreaterThan(0);
    }
  });

  it('respects context budget (< 80k bytes)', () => {
    const selected = selectContext(context, 'Add OrbitControls');
    expect(selected.totalBytes).toBeLessThan(80_000);
  });

  it('estimates tokens reasonably', () => {
    const selected = selectContext(context, 'Explain the project');
    expect(selected.estimatedTokens).toBeGreaterThan(0);
    expect(selected.estimatedTokens).toBeLessThan(50_000);
  });

  it('finds scene.ts when searching for scene-related changes', () => {
    const selected = selectContext(context, 'Modify scene background');
    expect(selected.files.some((f) => f.path.includes('scene'))).toBe(true);
  });
});

// ─── PromptBuilder ──────────────────────────────────────────────────────

describe('PromptBuilder', () => {
  it('builds a system prompt with task type', () => {
    const selected = selectContext(context, 'Add OrbitControls');
    const prompt = buildPrompt('modify', 'Add OrbitControls', selected, []);
    expect(prompt.system).toContain('Task Type: modify');
    expect(prompt.system).toContain('Output Format');
    expect(prompt.system).toContain('Rules');
  });

  it('builds a user prompt with mission and context', () => {
    const selected = selectContext(context, 'Add OrbitControls');
    const prompt = buildPrompt('modify', 'Add OrbitControls', selected, []);
    expect(prompt.user).toContain('Mission');
    expect(prompt.user).toContain('Add OrbitControls');
    expect(prompt.user).toContain('Relevant Files');
  });

  it('includes constraints when provided', () => {
    const selected = selectContext(context, 'Add OrbitControls');
    const prompt = buildPrompt('modify', 'Add OrbitControls', selected, ['TypeScript only', 'No external deps']);
    expect(prompt.system).toContain('TypeScript only');
    expect(prompt.system).toContain('No external deps');
  });

  it('produces deterministic output for same input', () => {
    const selected = selectContext(context, 'Add OrbitControls');
    const p1 = buildPrompt('modify', 'Add OrbitControls', selected, []);
    const p2 = buildPrompt('modify', 'Add OrbitControls', selected, []);
    expect(p1.system).toBe(p2.system);
    expect(p1.user).toBe(p2.user);
  });

  it('estimates tokens', () => {
    const selected = selectContext(context, 'Add OrbitControls');
    const prompt = buildPrompt('modify', 'Add OrbitControls', selected, []);
    expect(prompt.estimatedTokens).toBeGreaterThan(0);
  });

  it('includes verification requirements in system prompt', () => {
    const selected = selectContext(context, 'Add OrbitControls');
    const prompt = buildPrompt('modify', 'Add OrbitControls', selected, []);
    expect(prompt.system).toContain('Verification');
    expect(prompt.system).toContain('balanced');
  });

  it('includes file content in user prompt', () => {
    const selected = selectContext(context, 'Add OrbitControls');
    const prompt = buildPrompt('modify', 'Add OrbitControls', selected, []);
    for (const f of selected.files) {
      expect(prompt.user).toContain(f.path);
    }
  });
});

// ─── ModelRouter ────────────────────────────────────────────────────────

describe('ModelRouter', () => {
  it('selects claude-sonnet for modify tasks', () => {
    const sel = selectModel('modify');
    expect(sel.model).toContain('claude-3.5-sonnet');
    expect(sel.provider).toBe('openrouter');
  });

  it('selects gpt-4o-mini for explain tasks', () => {
    const sel = selectModel('explain');
    expect(sel.model).toContain('gpt-4o-mini');
  });

  it('selects claude-sonnet for refactor tasks', () => {
    const sel = selectModel('refactor');
    expect(sel.model).toContain('claude-3.5-sonnet');
  });

  it('selects claude-sonnet for debug tasks', () => {
    const sel = selectModel('debug');
    expect(sel.model).toContain('claude-3.5-sonnet');
  });

  it('honors user-specified provider and model', () => {
    const sel = selectModel('modify', 'openai', 'gpt-4o');
    expect(sel.provider).toBe('openai');
    expect(sel.model).toBe('gpt-4o');
    expect(sel.reason).toBe('user-specified');
  });

  it('returns a reason for each selection', () => {
    const sel = selectModel('optimize');
    expect(sel.reason.length).toBeGreaterThan(0);
  });

  it('falls back to default model for unknown task types', () => {
    const sel = selectModel('unknown' as any);
    expect(sel.model).toBeTruthy();
  });

  it('selects cheapest model for high-priority generate tasks', () => {
    const sel = selectModel('generate');
    expect(sel.model).toContain('claude-3.5-sonnet');
  });
});

// ─── ResponseParser ────────────────────────────────────────────────────

describe('ResponseParser', () => {
  it('parses valid JSON response with changes', () => {
    const raw = JSON.stringify({
      summary: 'Add OrbitControls import and instantiation',
      changes: [
        {
          file: 'src/main.ts',
          operation: 'insert-after',
          anchor: "import * as THREE from 'three';",
          text: "import { OrbitControls } from 'three/addons/controls/OrbitControls.js';",
          reason: 'Import OrbitControls',
        },
      ],
    });
    const result = parseResponse(raw);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]!.file).toBe('src/main.ts');
  });

  it('extracts JSON from markdown-wrapped response', () => {
    const raw = 'Here is the change:\n```json\n{\n  "summary": "test",\n  "changes": [{"file": "a.ts", "operation": "insert-after", "anchor": "x", "text": "y", "reason": "z"}]\n}\n```';
    const result = parseResponse(raw);
    expect(result.summary).toBe('test');
    expect(result.changes).toHaveLength(1);
  });

  it('rejects response without summary', () => {
    const raw = JSON.stringify({ changes: [] });
    expect(() => parseResponse(raw)).toThrow(ResponseParserError);
  });

  it('rejects response without changes array', () => {
    const raw = JSON.stringify({ summary: 'test' });
    expect(() => parseResponse(raw)).toThrow(ResponseParserError);
  });

  it('rejects response with invalid operation type', () => {
    const raw = JSON.stringify({
      summary: 'test',
      changes: [{ file: 'a.ts', operation: 'invalid', anchor: 'x', text: 'y', reason: 'z' }],
    });
    expect(() => parseResponse(raw)).toThrow(ResponseParserError);
  });

  it('rejects malformed JSON', () => {
    expect(() => parseResponse('not json at all')).toThrow(ResponseParserError);
  });

  it('rejects empty JSON object', () => {
    expect(() => parseResponse('{}')).toThrow(ResponseParserError);
  });

  it('converts parsed changes to Change[]', () => {
    const selected: import('./types').SelectedContext = {
      files: [{ path: 'src/main.ts', content: 'import * as THREE from "three";\nconst camera = new THREE.PerspectiveCamera();' }],
      architecture: 'Test',
      conventions: 'TypeScript',
      importsGraph: '',
      totalBytes: 100,
      estimatedTokens: 25,
    };
    const raw = JSON.stringify({
      summary: 'test',
      changes: [
        { file: 'src/main.ts', operation: 'insert-after', anchor: 'import', text: 'new code', reason: 'test' },
      ],
    });
    const parsed = parseResponse(raw);
    const changes = convertToChanges(parsed, selected, { type: 'none' });
    expect(changes).toHaveLength(1);
    expect(changes[0]!.file).toBe('src/main.ts');
    expect(changes[0]!.operation).toBe('edit');
  });

  it('creates new file for create operation', () => {
    const selected: import('./types').SelectedContext = {
      files: [{ path: 'src/main.ts', content: '' }],
      architecture: '',
      conventions: '',
      importsGraph: '',
      totalBytes: 0,
      estimatedTokens: 0,
    };
    const raw = JSON.stringify({
      summary: 'test',
      changes: [
        { file: 'src/new-file.ts', operation: 'create', anchor: '', text: 'console.log("hello");', reason: 'new file' },
      ],
    });
    const parsed = parseResponse(raw);
    const changes = convertToChanges(parsed, selected, { type: 'none' });
    expect(changes).toHaveLength(1);
    expect(changes[0]!.operation).toBe('create');
    expect(changes[0]!.newContent).toBe('console.log("hello");');
  });
});

// ─── DiffValidator ──────────────────────────────────────────────────────

describe('DiffValidator', () => {
  it('passes valid changes targeting allowed files', () => {
    const change: Change = {
      file: 'src/main.ts',
      operation: 'edit',
      edits: [{ file: 'src/main.ts', operation: 'insert-after', anchor: 'import', text: 'test', reason: 'test' }],
      reason: 'test',
      rollback: { type: 'none' },
    };
    const result = validateChanges([change], ['src/main.ts', 'src/scene.ts']);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects changes targeting files outside scope', () => {
    const change: Change = {
      file: 'src/secret.ts',
      operation: 'edit',
      edits: [{ file: 'src/secret.ts', operation: 'insert-after', anchor: 'import', text: 'test', reason: 'test' }],
      reason: 'test',
      rollback: { type: 'none' },
    };
    const result = validateChanges([change], ['src/main.ts']);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('not in the selected context'))).toBe(true);
  });

  it('rejects changes targeting dangerous directories', () => {
    const change: Change = {
      file: 'node_modules/evil.js',
      operation: 'edit',
      edits: [{ file: 'node_modules/evil.js', operation: 'insert-after', anchor: '', text: 'test', reason: 'test' }],
      reason: 'test',
      rollback: { type: 'none' },
    };
    const result = validateChanges([change], ['node_modules/evil.js']);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('dangerous'))).toBe(true);
  });

  it('rejects unknown operations', () => {
    const change: Change = {
      file: 'src/main.ts',
      operation: 'format' as any,
      edits: [],
      reason: 'test',
      rollback: { type: 'none' },
    };
    const result = validateChanges([change], ['src/main.ts']);
    expect(result.valid).toBe(false);
  });

  it('rejects empty change set', () => {
    const result = validateChanges([], ['src/main.ts']);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('No changes'))).toBe(true);
  });

  it('rejects edits with empty anchor on non-create operations', () => {
    const change: Change = {
      file: 'src/main.ts',
      operation: 'edit',
      edits: [{ file: 'src/main.ts', operation: 'insert-after', anchor: '', text: 'test', reason: 'test' }],
      reason: 'test',
      rollback: { type: 'none' },
    };
    const result = validateChanges([change], ['src/main.ts']);
    expect(result.valid).toBe(false);
  });
});

// ─── VerificationPipeline ──────────────────────────────────────────────

describe('VerificationPipeline', () => {
  it('passes verification for successful file changes', () => {
    const changeResult: ChangeResult = {
      file: 'src/main.ts',
      success: true,
      error: null,
      verification: null,
      backupPath: null,
    };
    const result = verifyChanges([changeResult], tmpDir);
    expect(result.passed).toBe(true);
  });

  it('fails verification for unsuccessful changes', () => {
    const changeResult: ChangeResult = {
      file: 'src/main.ts',
      success: false,
      error: 'Something failed',
      verification: null,
      backupPath: null,
    };
    const result = verifyChanges([changeResult], tmpDir);
    expect(result.passed).toBe(false);
  });

  it('detects syntax errors after a change', () => {
    const changeResult: ChangeResult = {
      file: 'src/main.ts',
      success: true,
      error: null,
      verification: { file: 'src/main.ts', passed: false, syntaxErrors: ['Braces mismatch'], importErrors: [], compilationErrors: [] },
      backupPath: null,
    };
    const result = verifyChanges([changeResult], tmpDir);
    expect(result.passed).toBe(false);
  });

  it('produces detailed step output', () => {
    const changeResult: ChangeResult = {
      file: 'src/main.ts',
      success: true,
      error: null,
      verification: null,
      backupPath: null,
    };
    const result = verifyChanges([changeResult], tmpDir);
    expect(result.steps.length).toBeGreaterThan(0);
    for (const step of result.steps) {
      expect(step.name).toBeTruthy();
      expect(typeof step.passed).toBe('boolean');
    }
  });
});

// ─── RetryStrategy ──────────────────────────────────────────────────────

describe('RetryStrategy', () => {
  it('allows retry on first attempt when verification fails', () => {
    const verificationResult = { passed: false, steps: [{ name: 'test', passed: false, output: 'error' }] };
    expect(shouldRetry(0, verificationResult, null)).toBe(true);
  });

  it('allows retry on first attempt when validation fails', () => {
    const validationResult = { valid: false, issues: [{ file: 'test.ts', message: 'error' }] };
    expect(shouldRetry(0, null, validationResult)).toBe(true);
  });

  it('does not retry after max attempts', () => {
    const verificationResult = { passed: false, steps: [{ name: 'test', passed: false, output: 'error' }] };
    expect(shouldRetry(1, verificationResult, null)).toBe(false);
  });

  it('does not retry if both verification and validation pass', () => {
    const verificationResult = { passed: true, steps: [] };
    const validationResult = { valid: true, issues: [] };
    expect(shouldRetry(0, verificationResult, validationResult)).toBe(false);
  });

  it('builds retry prompt with error context', () => {
    const original: any = {
      system: 'System prompt',
      user: 'User prompt',
      estimatedTokens: 100,
    };
    const changes: Change[] = [{
      file: 'src/main.ts',
      operation: 'edit',
      edits: [{ file: 'src/main.ts', operation: 'insert-after', anchor: 'import', text: 'bad code', reason: 'test' }],
      reason: 'test',
      rollback: { type: 'none' },
    }];
    const verificationResult = { passed: false, steps: [{ name: 'TypeScript Check', passed: false, output: 'Type error: X' }] };

    const retryPrompt = buildRetryPrompt(original, changes, verificationResult, null);
    expect(retryPrompt.system).toContain('Previous Attempt Failed');
    expect(retryPrompt.system).toContain('Type error');
    expect(retryPrompt.system).toContain('src/main.ts');
    expect(retryPrompt.user).toContain('retry');
  });

  it('builds retry prompt with validation errors', () => {
    const original: any = { system: 'S', user: 'U', estimatedTokens: 10 };
    const validationResult = { valid: false, issues: [{ file: 'bad.ts', message: 'Invalid operation' }] };
    const retryPrompt = buildRetryPrompt(original, [], null, validationResult);
    expect(retryPrompt.system).toContain('Validation Errors');
    expect(retryPrompt.system).toContain('Invalid operation');
  });
});

// ─── Integration with SafeEditor ───────────────────────────────────────

describe('Intelligence + SafeEditor integration', () => {
  it('can apply a parsed edit via SafeEditor', () => {
    const freshDir = mkdtempSync(join(tmpdir(), 'nova-intel-apply-'));
    try {
      createTestProject(freshDir);
      expect(existsSync(join(freshDir, 'src', 'main.ts'))).toBe(true);
    } finally {
      rmSync(freshDir, { recursive: true, force: true });
    }
  });
});

describe('PipelineReport structure', () => {
  it('PipelineReport has all required fields', () => {
    const report: PipelineReport = {
      request: 'Add OrbitControls',
      taskType: 'modify',
      selectedFileCount: 3,
      selectedTokenEstimate: 5000,
      promptTokenEstimate: 6000,
      modelUsed: 'openrouter/claude-3.5-sonnet',
      retryCount: 0,
      validationResult: { valid: true, issues: [] },
      verificationResult: { passed: true, steps: [] },
      changesApplied: 2,
      totalDurationMs: 1500,
      success: true,
      llmCalled: true,
      fallbackReason: null,
    };
    expect(report.request).toBe('Add OrbitControls');
    expect(report.success).toBe(true);
    expect(report.selectedFileCount).toBeGreaterThan(0);
    expect(report.totalDurationMs).toBeGreaterThan(0);
  });

  it('PipelineReport captures retry count', () => {
    const report: PipelineReport = {
      request: 'test',
      taskType: 'modify',
      selectedFileCount: 1,
      selectedTokenEstimate: 100,
      promptTokenEstimate: 200,
      modelUsed: 'test',
      retryCount: 2,
      validationResult: { valid: true, issues: [] },
      verificationResult: { passed: false, steps: [{ name: 'test', passed: false, output: 'error' }] },
      changesApplied: 0,
      totalDurationMs: 100,
      success: false,
      llmCalled: true,
      fallbackReason: null,
    };
    expect(report.retryCount).toBe(2);
    expect(report.success).toBe(false);
  });
});

// ─── PipelineContext validation ────────────────────────────────────────

describe('PipelineContext', () => {
  it('can construct a valid PipelineContext', () => {
    const ctx: PipelineContext = {
      request: 'Add OrbitControls',
      taskType: 'modify',
      projectDir: '/test',
      context: context,
      intent: { intent: 'create', targets: ['main.ts'], description: 'Add OrbitControls', confidence: 0.8 },
    };
    expect(ctx.request).toBe('Add OrbitControls');
    expect(ctx.taskType).toBe('modify');
    expect(ctx.projectDir).toBe('/test');
  });
});

// ─── RetryStrategy edge cases ──────────────────────────────────────────

describe('RetryStrategy edge cases', () => {
  it('returns false when both results are null on first attempt', () => {
    expect(shouldRetry(0, null, null)).toBe(false);
  });

  it('prefers verification failure over validation success', () => {
    const vf = { passed: false, steps: [{ name: 't', passed: false, output: 'e' }] };
    const vl = { valid: true, issues: [] };
    expect(shouldRetry(0, vf, vl)).toBe(true);
  });

  it('handles empty steps array in verification', () => {
    const vf = { passed: false, steps: [] };
    expect(shouldRetry(0, vf, null)).toBe(true);
  });
});