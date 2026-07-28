import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ToolManager } from '@gamedev-agent/tool-runtime';
import { runMission } from './mission';
import { createNativeToolManager, disposeToolManager } from './executor';

const originalCwd = process.cwd();
let tmpDir: string;
let manager: ToolManager;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'nova-v0.1-mission-test-'));
  manager = await createNativeToolManager();
});

afterAll(() => {
  disposeToolManager();
  process.chdir(originalCwd);
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // Windows may hold file locks on node_modules — temp dir cleanup is best-effort
  }
});

function withTmpDir<T>(fn: () => Promise<T>): Promise<T> {
  process.chdir(tmpDir);
  return fn().finally(() => {
    process.chdir(originalCwd);
  });
}

describe('runMission', () => {
  it(
    'completes a full Three.js project creation',
    async () => {
      await withTmpDir(async () => {
        const projectName = `threejs-test-${Date.now()}`;
        const result = await runMission(
          `Create a Three.js project called ${projectName}`,
          manager,
        );

        expect(result.status).toBe('completed');
        expect(result.taskResults).toHaveLength(8);
        expect(result.failedTask).toBeNull();
        expect(result.failureDiagnosis).toBeNull();
        expect(result.totalDurationMs).toBeGreaterThan(0);
      });
    },
    300_000,
  );

  it('fails gracefully for unsupported goal', async () => {
    const result = await runMission('Make a game in Godot engine', manager);

    expect(result.status).toBe('failed');
    expect(result.taskResults).toHaveLength(0);
  });

  it('fails gracefully for empty message', async () => {
    const result = await runMission('', manager);

    expect(result.status).toBe('failed');
    expect(result.taskResults).toHaveLength(0);
  });

  it(
    'includes summary string in result',
    async () => {
      await withTmpDir(async () => {
        const projectName = `threejs-summary-${Date.now()}`;
        const result = await runMission(
          `Create a Three.js project called ${projectName}`,
          manager,
        );

        expect(result.summary).toBeTruthy();
        expect(result.summary).toContain('Mission');
      });
    },
    300_000,
  );

  it(
    'appends numeric suffix when project directory exists',
    async () => {
      await withTmpDir(async () => {
        const suffix = Date.now();
        const dirName = `threejs-${suffix}`;
        await mkdir(dirName, { recursive: true });

        const result = await runMission(
          `threejs ${suffix}`,
          manager,
        );

        expect(result.status).toBe('completed');
        expect(result.goal.projectName).toBe(`${dirName}-2`);
      });
    },
    300_000,
  );

  it(
    'increments suffix until directory is free',
    async () => {
      await withTmpDir(async () => {
        const suffix = Date.now();
        const dirName = `threejs-${suffix}`;
        await mkdir(dirName, { recursive: true });
        await mkdir(`${dirName}-2`, { recursive: true });

        const result = await runMission(
          `threejs ${suffix}`,
          manager,
        );

        expect(result.status).toBe('completed');
        expect(result.goal.projectName).toBe(`${dirName}-3`);
      });
    },
    300_000,
  );

  it(
    'does not overwrite existing project directory',
    async () => {
      await withTmpDir(async () => {
        const suffix = Date.now();
        const dirName = `threejs-${suffix}`;
        await mkdir(dirName, { recursive: true });
        // Write a sentinel file into the existing directory
        await writeFile(join(dirName, 'sentinel.txt'), 'original', 'utf-8');

        const result = await runMission(
          `threejs ${suffix}`,
          manager,
        );

        // The original directory must still exist with its sentinel
        expect(existsSync(join(dirName, 'sentinel.txt'))).toBe(true);
        // The actual project was created in dirName-2
        expect(result.status).toBe('completed');
        expect(result.goal.projectName).toBe(`${dirName}-2`);
      });
    },
    300_000,
  );

  it(
    'does not create project directory when parse fails',
    async () => {
      await withTmpDir(async () => {
        const result = await runMission('Make a game in Godot engine', manager);
        expect(result.status).toBe('failed');
        // No directory should exist since parse failed before planning
        expect(existsSync('make-a-game-in-godot-engine')).toBe(false);
      });
    },
    10_000,
  );
});
