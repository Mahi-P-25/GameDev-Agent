import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanRepo } from './repo-scanner';
import { scanSource } from './source-scanner';
import { scanAssets } from './asset-scanner';
import { analyzeArchitecture } from './arch-analyzer';
import { scanProject, formatContextSummary } from './scanner';
import type { SourceFile } from './types';

function createThreeProject(rootDir: string): void {
  mkdirSync(join(rootDir, 'src', 'managers'), { recursive: true });
  mkdirSync(join(rootDir, 'src', 'utils'), { recursive: true });
  writeFileSync(join(rootDir, 'package.json'), JSON.stringify({
    name: 'three-test',
    version: '1.0.0',
    dependencies: { three: '^0.160.0' },
    devDependencies: { typescript: '^5.3.0', vite: '^5.0.0' },
    scripts: { build: 'vite build', dev: 'vite' },
    main: 'src/main.ts',
  }), 'utf-8');
  writeFileSync(join(rootDir, 'tsconfig.json'), '{}', 'utf-8');
  writeFileSync(join(rootDir, 'vite.config.ts'), 'import { defineConfig } from "vite";\nexport default defineConfig({});', 'utf-8');
  writeFileSync(join(rootDir, 'src', 'main.ts'), [
    'import * as THREE from "three";',
    'import { createScene } from "./scene";',
    'import { GameManager } from "./managers/GameManager";',
    '',
    'const scene = new THREE.Scene();',
    'const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);',
    'const renderer = new THREE.WebGLRenderer();',
    'renderer.setSize(800, 600);',
    'document.body.appendChild(renderer.domElement);',
    'new GameManager(scene, camera, renderer);',
    'const geo = new THREE.BoxGeometry();',
    'function animate() {}',
    'animate();',
  ].join('\n'), 'utf-8');
  writeFileSync(join(rootDir, 'src', 'scene.ts'), [
    'import { Scene } from "three";',
    '',
    'export function createScene(): Scene {',
    '  return new Scene();',
    '}',
  ].join('\n'), 'utf-8');
  writeFileSync(join(rootDir, 'src', 'managers', 'GameManager.ts'), [
    'import * as THREE from "three";',
    '',
    'export class GameManager {',
    '  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {}',
    '}',
  ].join('\n'), 'utf-8');
  writeFileSync(join(rootDir, 'src', 'utils', 'math.ts'), [
    'export function clamp(v: number, min: number, max: number): number {',
    '  return Math.max(min, Math.min(max, v));',
    '}',
  ].join('\n'), 'utf-8');
}

function createProjectWithAssets(rootDir: string): void {
  createThreeProject(rootDir);
  mkdirSync(join(rootDir, 'assets', 'models'), { recursive: true });
  mkdirSync(join(rootDir, 'assets', 'textures'), { recursive: true });
  mkdirSync(join(rootDir, 'assets', 'shaders'), { recursive: true });
  mkdirSync(join(rootDir, 'assets', 'audio'), { recursive: true });
  mkdirSync(join(rootDir, 'assets', 'animations'), { recursive: true });
  writeFileSync(join(rootDir, 'assets', 'models', 'character.glb'), '');
  writeFileSync(join(rootDir, 'assets', 'models', 'environment.glb'), '');
  writeFileSync(join(rootDir, 'assets', 'models', 'character.mtl'), '');
  writeFileSync(join(rootDir, 'assets', 'textures', 'floor.png'), '');
  writeFileSync(join(rootDir, 'assets', 'textures', 'wall.jpg'), '');
  writeFileSync(join(rootDir, 'assets', 'shaders', 'vertex.glsl'), '');
  writeFileSync(join(rootDir, 'assets', 'shaders', 'fragment.glsl'), '');
  writeFileSync(join(rootDir, 'assets', 'audio', 'ambient.ogg'), '');
  writeFileSync(join(rootDir, 'assets', 'animations', 'walk.anim'), '');
  writeFileSync(join(rootDir, 'src', 'asset-loader.ts'), [
    'import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";',
    '',
    'const loader = new GLTFLoader();',
    'loader.load("assets/models/character.glb", (gltf) => {});',
    'loader.load("assets/models/missing.glb", (gltf) => {});',
    '',
    'const img = new Image();',
    'img.src = "assets/textures/floor.png";',
  ].join('\n'), 'utf-8');
}

// ─── Repo Scanner ─────────────────────────────────────────────────────

describe('scanRepo', () => {
  let tmpDir: string;

  afterAll(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* windows */ }
  });

  it('detects npm as default package manager', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'nova-repo-'));
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0' }), 'utf-8');
    const info = scanRepo(tmpDir);
    expect(info.packageManager).toBe('npm');
  });

  it('detects yarn from lockfile', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'nova-repo-'));
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0', dependencies: { three: '^0.160.0' } }), 'utf-8');
    writeFileSync(join(tmpDir, 'yarn.lock'), '# yarn lockfile', 'utf-8');
    const info = scanRepo(tmpDir);
    expect(info.packageManager).toBe('yarn');
  });

  it('detects three.js framework from dependencies', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'nova-repo-'));
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({
      name: 'three-test',
      dependencies: { three: '^0.160.0' },
    }), 'utf-8');
    const info = scanRepo(tmpDir);
    expect(info.framework).toBe('three.js');
  });

  it('detects TypeScript from tsconfig.json', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'nova-repo-'));
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'ts-test', devDependencies: { typescript: '^5.0.0' } }), 'utf-8');
    writeFileSync(join(tmpDir, 'tsconfig.json'), '{}', 'utf-8');
    const info = scanRepo(tmpDir);
    expect(info.language).toBe('typescript');
  });

  it('detects vite from config file', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'nova-repo-'));
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'vite-test', scripts: { build: 'vite build' } }), 'utf-8');
    writeFileSync(join(tmpDir, 'vite.config.ts'), 'export default defineConfig({});', 'utf-8');
    const info = scanRepo(tmpDir);
    expect(info.buildSystem).toBe('vite');
  });

  it('detects git repository and branch', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'nova-repo-'));
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'git-test' }), 'utf-8');
    mkdirSync(join(tmpDir, '.git'), { recursive: true });
    writeFileSync(join(tmpDir, '.git', 'HEAD'), 'ref: refs/heads/main\n', 'utf-8');
    const info = scanRepo(tmpDir);
    expect(info.isGitRepo).toBe(true);
    expect(info.gitBranch).toBe('main');
  });

  it('returns null fields for empty project', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'nova-repo-'));
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'x', version: '0.0.0' }), 'utf-8');
    const info = scanRepo(tmpDir);
    expect(info.framework).toBeNull();
    expect(info.language).toBeNull();
    expect(info.buildSystem).toBeNull();
    expect(info.isGitRepo).toBe(false);
  });
});

// ─── Source Scanner ──────────────────────────────────────────────────

describe('scanSource', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'nova-source-'));
    createThreeProject(tmpDir);
  });

  afterAll(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* windows */ }
  });

  it('discovers all source files', () => {
    const info = scanSource(tmpDir);
    expect(info.fileCount).toBeGreaterThanOrEqual(4);
  });

  it('maps file paths as relative', () => {
    const info = scanSource(tmpDir);
    for (const f of info.files) {
      expect(f.path).not.toContain(tmpDir);
    }
  });

  it('parses imports (both relative and package)', () => {
    const info = scanSource(tmpDir);
    const mainFile = info.files.find((f) => f.path.endsWith('main.ts'));
    expect(mainFile).toBeDefined();
    expect(mainFile!.imports).toContain('three');
    expect(mainFile!.imports).toContain('./scene');
    expect(mainFile!.imports).toContain('./managers/GameManager');
  });

  it('parses exports', () => {
    const info = scanSource(tmpDir);
    const sceneFile = info.files.find((f) => f.path.endsWith('scene.ts'));
    expect(sceneFile).toBeDefined();
    expect(sceneFile!.exports.some((e) => e.includes('createScene'))).toBe(true);
  });

  it('detects systems from directory naming', () => {
    const info = scanSource(tmpDir);
    const managerSys = info.systems.find((s) => s.name === 'Managers');
    expect(managerSys).toBeDefined();
    expect(managerSys!.files.some((f) => f.includes('managers'))).toBe(true);
  });

  it('detects entry points', () => {
    const info = scanSource(tmpDir);
    expect(info.entryPoints.some((e) => e.endsWith('main.ts'))).toBe(true);
  });

  it('builds import graph with edges for relative imports', () => {
    const info = scanSource(tmpDir);
    expect(info.importGraph.nodes.length).toBeGreaterThanOrEqual(4);
    const mainNode = info.importGraph.nodes.find((n) => n.endsWith('main.ts'));
    expect(mainNode).toBeDefined();
    const sceneEdge = info.importGraph.edges.find(([from]) => from.endsWith('main.ts'));
    expect(sceneEdge).toBeDefined();
    expect(sceneEdge![1]).toMatch(/scene\.ts$/);
  });

  it('returns empty result for empty directory', () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'nova-empty-source-'));
    try {
      const info = scanSource(emptyDir);
      expect(info.fileCount).toBe(0);
      expect(info.files).toHaveLength(0);
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});

// ─── Asset Scanner ───────────────────────────────────────────────────

describe('scanAssets', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'nova-asset-'));
    createProjectWithAssets(tmpDir);
  });

  afterAll(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* windows */ }
  });

  it('discovers model files', () => {
    const info = scanAssets(tmpDir);
    expect(info.models.length).toBeGreaterThanOrEqual(2);
    expect(info.models.some((a) => a.name === 'character.glb')).toBe(true);
  });

  it('discovers texture files', () => {
    const info = scanAssets(tmpDir);
    expect(info.textures.some((a) => a.name === 'floor.png')).toBe(true);
    expect(info.textures.some((a) => a.name === 'wall.jpg')).toBe(true);
  });

  it('discovers shader files', () => {
    const info = scanAssets(tmpDir);
    expect(info.shaders.some((a) => a.name === 'vertex.glsl')).toBe(true);
  });

  it('discovers audio files', () => {
    const info = scanAssets(tmpDir);
    expect(info.audio.some((a) => a.name === 'ambient.ogg')).toBe(true);
  });

  it('discovers material files', () => {
    const info = scanAssets(tmpDir);
    expect(info.materials.length).toBeGreaterThanOrEqual(1);
  });

  it('discovers animation files', () => {
    const info = scanAssets(tmpDir);
    expect(info.animations.some((a) => a.name === 'walk.anim')).toBe(true);
  });

  it('records size and metadata', () => {
    const info = scanAssets(tmpDir);
    const model = info.models.find((a) => a.name === 'character.glb');
    expect(model).toBeDefined();
    expect(model!.format).toBe('glb');
  });

  it('detects missing references', () => {
    const info = scanAssets(tmpDir);
    const missingModel = info.missingReferences.find(
      (r) => r.reference.includes('missing.glb') && r.type === 'model',
    );
    expect(missingModel).toBeDefined();
  });

  it('does not report existing assets as missing', () => {
    const info = scanAssets(tmpDir);
    const missingFloor = info.missingReferences.find(
      (r) => r.reference.includes('floor.png'),
    );
    expect(missingFloor).toBeUndefined();
  });

  it('reports no false positives for project-root-relative paths', () => {
    const info = scanAssets(tmpDir);
    const missingCharacter = info.missingReferences.find(
      (r) => r.reference.includes('character.glb'),
    );
    expect(missingCharacter).toBeUndefined();
  });
});

// ─── Architecture Analyzer ───────────────────────────────────────────

describe('analyzeArchitecture', () => {
  let tmpDir: string;
  let sourceFiles: ReadonlyArray<SourceFile>;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'nova-arch-'));
    createThreeProject(tmpDir);
    const info = scanSource(tmpDir);
    sourceFiles = info.files;
  });

  afterAll(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* windows */ }
  });

  it('detects manager pattern from file paths', () => {
    const arch = analyzeArchitecture(sourceFiles, tmpDir);
    expect(arch.managers.length).toBeGreaterThanOrEqual(1);
    expect(arch.managers.some((m) => m.includes('GameManager'))).toBe(true);
  });

  it('returns a description string', () => {
    const arch = analyzeArchitecture(sourceFiles, tmpDir);
    expect(arch.description.length).toBeGreaterThan(0);
  });

  it('detects architecture pattern', () => {
    const arch = analyzeArchitecture(sourceFiles, tmpDir);
    expect(arch.pattern).toBeTruthy();
  });
});

// ─── Integration: scanProject ────────────────────────────────────────

describe('scanProject', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'nova-integ-'));
    createProjectWithAssets(tmpDir);
  });

  afterAll(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* windows */ }
  });

  it('produces a complete ProjectContext', async () => {
    const ctx = await scanProject(tmpDir);
    expect(ctx.projectPath).toBe(tmpDir);
    expect(ctx.repo.framework).toBe('three.js');
    expect(ctx.source.fileCount).toBeGreaterThan(0);
    expect(ctx.assets.models.length).toBeGreaterThan(0);
    expect(ctx.architecture.pattern).toBeTruthy();
    expect(ctx.scannedAt).toBeTruthy();
    expect(() => new Date(ctx.scannedAt)).not.toThrow();
  });
});

// ─── formatContextSummary ────────────────────────────────────────────

describe('formatContextSummary', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'nova-fmt-'));
    createProjectWithAssets(tmpDir);
  });

  afterAll(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* windows */ }
  });

  it('returns a non-empty string with key sections', async () => {
    const ctx = await scanProject(tmpDir);
    const summary = formatContextSummary(ctx);
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('three.js');
    expect(summary).toContain('Source files');
  });
});
