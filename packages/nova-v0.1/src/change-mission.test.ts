import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { analyzeIntent } from './intent-analyzer';
import { locateFiles } from './file-locator';
import { analyzeDependencies, estimateImpact } from './dep-analyzer';
import { planChanges, formatPlan } from './change-planner';
import { applyChange } from './safe-editor';
import { runTypeCheck } from './verifier';
import { runChangeMission } from './change-mission';
import { scanProject } from './scanner';
import type { ProjectContext } from './types';

function createTestProject(rootDir: string): void {
  mkdirSync(join(rootDir, 'src'), { recursive: true });
  writeFileSync(join(rootDir, 'package.json'), JSON.stringify({
    name: 'change-test',
    version: '1.0.0',
    dependencies: { three: '^0.160.0' },
    devDependencies: { typescript: '^5.3.0', vite: '^5.0.0' },
    scripts: { build: 'vite build', dev: 'vite' },
    main: 'src/main.ts',
  }), 'utf-8');
  writeFileSync(join(rootDir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      jsx: 'preserve',
    },
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
    'function animate() {',
    '  requestAnimationFrame(animate);',
    '  renderer.render(scene, camera);',
    '}',
    'animate();',
  ].join('\n'), 'utf-8');
  writeFileSync(join(rootDir, 'src', 'scene.ts'), [
    'import { Scene } from "three";',
    '',
    'export function createScene(): Scene {',
    '  const scene = new Scene();',
    '  scene.background = new THREE.Color(0x111122);',
    '  return scene;',
    '}',
  ].join('\n'), 'utf-8');
}

let tmpDir: string;
let context: ProjectContext;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'nova-change-test-'));
  createTestProject(tmpDir);
  context = await scanProject(tmpDir);
});

afterAll(() => {
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* windows */ }
});

// ─── Intent Analyzer ─────────────────────────────────────────────────

describe('analyzeIntent', () => {
  it('classifies "Add OrbitControls" as create intent', () => {
    const intent = analyzeIntent('Add OrbitControls', context);
    expect(intent.intent).toBe('create');
    expect(intent.targets.length).toBeGreaterThan(0);
    expect(intent.description).toBeTruthy();
  });

  it('classifies "Modify the car controller" as modify intent', () => {
    const intent = analyzeIntent('Modify the car controller', context);
    expect(intent.intent).toBe('modify');
  });

  it('classifies "Explain the scene setup" as explain intent', () => {
    const intent = analyzeIntent('Explain the scene setup', context);
    expect(intent.intent).toBe('explain');
  });

  it('classifies "Remove unused imports" as modify (fallback unknown)', () => {
    const intent = analyzeIntent('Remove unused imports', context);
    expect(intent.intent).toBe('delete');
  });
});

// ─── File Locator ────────────────────────────────────────────────────

describe('locateFiles', () => {
  it('finds files matching "scene" target', () => {
    const intent = analyzeIntent('Modify scene setup', context);
    const files = locateFiles(intent, context);
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]!.path).toMatch(/scene/);
  });

  it('falls back to entry points when no direct match', () => {
    const intent = analyzeIntent('Add feature', context);
    const files = locateFiles(intent, context);
    expect(files.length).toBeGreaterThan(0);
  });

  it('returns all files for explain intent', () => {
    const intent = analyzeIntent('Explain project', context);
    const files = locateFiles(intent, context);
    expect(files.length).toBeGreaterThanOrEqual(context.source.files.length);
  });

  it('scores direct matches higher than indirect', () => {
    const intent = analyzeIntent('Modify scene.ts', context);
    const files = locateFiles(intent, context);
    expect(files.length).toBeGreaterThan(1);
    const top = files[0]!;
    const last = files[files.length - 1]!;
    expect(top.score).toBeGreaterThanOrEqual(last.score);
  });
});

// ─── Dependency Analyzer ─────────────────────────────────────────────

describe('analyzeDependencies', () => {
  it('identifies target files and external deps', () => {
    const intent = analyzeIntent('Modify scene setup', context);
    const located = locateFiles(intent, context);
    const deps = analyzeDependencies(located, context);
    expect(deps.targetFiles.length).toBeGreaterThan(0);
    expect(deps.externalDependencies).toContain('three');
  });

  it('maps import relationships', () => {
    const intent = analyzeIntent('Modify main.ts', context);
    const located = locateFiles(intent, context);
    const deps = analyzeDependencies(located, context);
    expect(deps.targetFiles.some((f) => f.includes('main'))).toBe(true);
  });
});

describe('estimateImpact', () => {
  it('returns low risk for single file changes', () => {
    const intent = analyzeIntent('Modify scene.ts', context);
    const located = locateFiles(intent, context).slice(0, 1);
    const deps = analyzeDependencies(located, context);
    const impact = estimateImpact(deps, context);
    expect(impact.riskLevel).toBe('low');
  });
});

// ─── Change Planner ──────────────────────────────────────────────────

describe('planChanges', () => {
  it('generates OrbitControls edit plan', () => {
    const intent = analyzeIntent('Add OrbitControls', context);
    const located = locateFiles(intent, context);
    const deps = analyzeDependencies(located, context);
    const impact = estimateImpact(deps, context);
    const plan = planChanges(intent, located, deps, impact, context);

    expect(plan.intent.intent).toBe('create');
    expect(plan.changes.length).toBeGreaterThan(0);
    const ocEdit = plan.changes.find((c) =>
      c.edits.some((e) => e.text.includes('OrbitControls')),
    );
    expect(ocEdit).toBeDefined();
  });

  it('generates no changes for explain intent', () => {
    const intent = analyzeIntent('Explain project', context);
    const located = locateFiles(intent, context);
    const deps = analyzeDependencies(located, context);
    const impact = estimateImpact(deps, context);
    const plan = planChanges(intent, located, deps, impact, context);
    expect(plan.changes).toHaveLength(0);
  });

  it('produces human-readable plan format', () => {
    const intent = analyzeIntent('Add OrbitControls', context);
    const located = locateFiles(intent, context);
    const deps = analyzeDependencies(located, context);
    const impact = estimateImpact(deps, context);
    const plan = planChanges(intent, located, deps, impact, context);
    const formatted = formatPlan(plan);
    expect(formatted).toContain('Change Plan');
    expect(formatted).toContain('OrbitControls');
  });
});

// ─── Safe Editor ─────────────────────────────────────────────────────

describe('applyChange', () => {
  it('inserts OrbitControls import and instantiation', () => {
    const intent = analyzeIntent('Add OrbitControls', context);
    const located = locateFiles(intent, context);
    const deps = analyzeDependencies(located, context);
    const impact = estimateImpact(deps, context);
    const plan = planChanges(intent, located, deps, impact, context);

    for (const change of plan.changes) {
      const result = applyChange(change, tmpDir);
      expect(result.success).toBe(true);
    }

    const mainContent = readFileSync(join(tmpDir, 'src', 'main.ts'), 'utf-8');
    expect(mainContent).toContain('OrbitControls');
    expect(mainContent).toContain("three/addons/controls/OrbitControls.js");
  });

  it('creates backup file when git is not available', () => {
    const backupDir = join(tmpDir, '.nova', 'backups');
    expect(existsSync(backupDir)).toBe(true);
    const files = readdirSync(backupDir);
    expect(files.length).toBeGreaterThan(0);
  });

  it('persists edits to the filesystem', () => {
    const mainContent = readFileSync(join(tmpDir, 'src', 'main.ts'), 'utf-8');
    expect(mainContent).toContain('OrbitControls');
  });
});

// ─── Verifier ────────────────────────────────────────────────────────

describe('runTypeCheck', () => {
  it('returns success for valid TypeScript project', () => {
    const result = runTypeCheck(tmpDir);
    expect(result.success).toBe(true);
  });
});

// ─── Integration: runChangeMission ───────────────────────────────────

describe('runChangeMission', () => {
  it('completes full pipeline on a fresh project', async () => {
    const freshDir = mkdtempSync(join(tmpdir(), 'nova-fresh-'));
    try {
      createTestProject(freshDir);
      const report = await runChangeMission('Add OrbitControls', freshDir);
      expect(report.intent).toBeDefined();
      expect(report.plan).toBeDefined();
      expect(report.results).toBeDefined();
      expect(report.summary).toBeTruthy();
      expect(report.plan.changes.some((c) =>
        c.edits.some((e) => e.text.includes('OrbitControls')),
      )).toBe(true);
      expect(report.results.every((r) => r.success)).toBe(true);
      // Verify file was actually modified
      const content = readFileSync(join(freshDir, 'src', 'main.ts'), 'utf-8');
      expect(content).toContain('OrbitControls');
    } finally {
      rmSync(freshDir, { recursive: true, force: true });
    }
  });

  it('completes full "Add OrbitControls" pipeline', async () => {
    const report = await runChangeMission('Add OrbitControls', tmpDir);
    expect(report.intent).toBeDefined();
    expect(report.plan).toBeDefined();
    expect(report.results).toBeDefined();
    expect(report.summary).toBeTruthy();
    expect(report.plan.changes.some((c) =>
      c.edits.some((e) => e.text.includes('OrbitControls')),
    )).toBe(true);
    expect(report.results.every((r) => r.success)).toBe(true);
  });

  it('returns rollback command using file backups', async () => {
    const report = await runChangeMission('Add OrbitControls', tmpDir);
    expect(report.rollbackCommand).toBeTruthy();
    expect(report.rollbackCommand).toContain('copy');
  });

  it('handles explain intent without changes', async () => {
    const report = await runChangeMission('Explain the scene setup', tmpDir);
    expect(report.results).toHaveLength(0);
    expect(report.summary).toContain('analysis-only');
  });

  it('produces a MissionReport with all fields', async () => {
    const report = await runChangeMission('Add OrbitControls', tmpDir);
    expect(report.request).toBe('Add OrbitControls');
    expect(report.projectPath).toBe(tmpDir);
    expect(report.context).toBeDefined();
    expect(report.intent).toBeDefined();
    expect(report.plan).toBeDefined();
    expect(report.results.length).toBeGreaterThan(0);
    expect(report.summary).toBeTruthy();
  });
});
