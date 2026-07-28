import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ToolManager } from '@gamedev-agent/tool-runtime';
import { executeTask, createNativeToolManager, disposeToolManager } from './executor';
import type { Task } from './types';

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'nova-v0.1-exec-test-'));
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('executeTask', () => {
  let manager: ToolManager;

  beforeAll(async () => {
    manager = await createNativeToolManager();
  });

  afterAll(() => {
    disposeToolManager();
  });

  it('creates a directory', async () => {
    const dir = join(tmpDir, 'test-dir');
    const task: Task = {
      id: 'test-mkdir',
      label: 'Create test directory',
      toolId: 'nova.tool.filesystem',
      action: 'files.create',
      input: { path: dir, kind: 'directory' },
      timeoutMs: 5000,
      dependsOn: [],
    };

    const result = await executeTask(task, manager);
    expect(result.success).toBe(true);
    expect(existsSync(dir)).toBe(true);
  });

  it('writes a file', async () => {
    const dir = join(tmpDir, 'write-test');
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, 'hello.txt');
    const task: Task = {
      id: 'test-write',
      label: 'Write test file',
      toolId: 'nova.tool.filesystem',
      action: 'files.write',
      input: { path: filePath, content: 'Hello, Nova!' },
      timeoutMs: 5000,
      dependsOn: [],
    };

    const result = await executeTask(task, manager);
    expect(result.success).toBe(true);

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('Hello, Nova!');
  });

  it('creates parent directories when writing to a nested path', async () => {
    const filePath = join(tmpDir, 'nested/a/b/c', 'deep.txt');
    const task: Task = {
      id: 'test-deep-write',
      label: 'Write to nested path',
      toolId: 'nova.tool.filesystem',
      action: 'files.write',
      input: { path: filePath, content: 'deep' },
      timeoutMs: 5000,
      dependsOn: [],
    };

    const result = await executeTask(task, manager);
    expect(result.success).toBe(true);
    expect(existsSync(filePath)).toBe(true);
  });

  it('runs a terminal command and returns stdout', async () => {
    const script = `${tmpDir}/echo-test.mjs`;
    await writeFile(script, "console.log('hello from nova')\n", 'utf-8');
    const task: Task = {
      id: 'test-echo',
      label: 'Echo test',
      toolId: 'nova.tool.terminal',
      action: 'terminal.run',
      input: { command: 'node', args: [script], cwd: tmpDir },
      timeoutMs: 10000,
      dependsOn: [],
    };

    const result = await executeTask(task, manager);
    expect(result.success).toBe(true);
    expect(result.output).not.toBeNull();
  });

  it('reports failure for a non-existent command', async () => {
    const task: Task = {
      id: 'test-fail',
      label: 'Fail test',
      toolId: 'nova.tool.terminal',
      action: 'terminal.run',
      input: { command: 'nonexistent-command-12345', cwd: tmpDir },
      timeoutMs: 5000,
      dependsOn: [],
    };

    const result = await executeTask(task, manager);
    expect(result.success).toBe(false);
    expect(result.error).not.toBeNull();
  });

  it('removes a file', async () => {
    const filePath = join(tmpDir, 'remove-me.txt');
    await writeFile(filePath, 'delete me', 'utf-8');
    const task: Task = {
      id: 'test-remove',
      label: 'Remove test file',
      toolId: 'nova.tool.filesystem',
      action: 'files.remove',
      input: { path: filePath },
      timeoutMs: 5000,
      dependsOn: [],
    };

    const result = await executeTask(task, manager);
    expect(result.success).toBe(true);
    expect(existsSync(filePath)).toBe(false);
  });

  it('removes a directory recursively', async () => {
    const dir = join(tmpDir, 'remove-dir');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'nested.txt'), 'nested', 'utf-8');
    const task: Task = {
      id: 'test-remove-dir',
      label: 'Remove test directory',
      toolId: 'nova.tool.filesystem',
      action: 'files.remove',
      input: { path: dir },
      timeoutMs: 5000,
      dependsOn: [],
    };

    const result = await executeTask(task, manager);
    expect(result.success).toBe(true);
    expect(existsSync(dir)).toBe(false);
  });

  it('handles remove of non-existent path gracefully', async () => {
    const task: Task = {
      id: 'test-remove-nonexistent',
      label: 'Remove non-existent path',
      toolId: 'nova.tool.filesystem',
      action: 'files.remove',
      input: { path: join(tmpDir, 'does-not-exist') },
      timeoutMs: 5000,
      dependsOn: [],
    };

    const result = await executeTask(task, manager);
    expect(result.success).toBe(true);
  });

  it('reports failure for unknown action', async () => {
    const task: Task = {
      id: 'test-bad-action',
      label: 'Bad action',
      toolId: 'nova.tool.filesystem',
      action: 'files.nonexistent',
      input: {},
      timeoutMs: 5000,
      dependsOn: [],
    };

    const result = await executeTask(task, manager);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
