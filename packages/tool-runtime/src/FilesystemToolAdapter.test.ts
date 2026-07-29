import type { EventBusContract, EventDefinition } from '@gamedev-agent/events';
import { describe, expect, it } from 'vitest';
import {
  FILESYSTEM_TOOL_ID,
  FilesystemToolAdapter,
  filesystemDescriptor,
} from './FilesystemToolAdapter';
import type { FSImplementation } from './FilesystemToolAdapter';
import { ToolManager } from './ToolManager';
import { asToolId } from './ToolTypes';

function makeBus(): EventBusContract & { published: Array<{ type: string; payload: unknown }> } {
  const published: Array<{ type: string; payload: unknown }> = [];
  return {
    published,
    async publish<T>(definition: EventDefinition<T>, payload: T): Promise<void> {
      published.push({ type: definition.type, payload });
    },
    subscribe: () => ({ dispose: () => {} }),
    once: () => ({ dispose: () => {} }),
    unsubscribe: () => {},
    replay: () => [],
    history: () => [],
    clearHistory: () => {},
    use: () => {},
    metrics: () => ({
      published: 0,
      delivered: 0,
      dropped: 0,
      historySize: 0,
      subscriberCount: 0,
      failedHandlers: 0,
      lastPublishMicros: 0,
    }),
    dispose: () => {},
  } as unknown as EventBusContract & { published: Array<{ type: string; payload: unknown }> };
}

function makeFS(): FSImplementation {
  const files = new Map<string, string>();
  return {
    async readFile(path: string): Promise<string> {
      const content = files.get(path);
      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return content;
    },
    async writeFile(path: string, content: string): Promise<void> {
      files.set(path, content);
    },
    async createFile(path: string, content?: string): Promise<void> {
      if (files.has(path)) throw new Error(`EEXIST: ${path}`);
      files.set(path, content ?? '');
    },
    async deleteFile(path: string, _recursive?: boolean): Promise<void> {
      files.delete(path);
    },
    async renameFile(from: string, to: string): Promise<void> {
      const content = files.get(from);
      if (content === undefined) throw new Error(`ENOENT: ${from}`);
      files.delete(from);
      files.set(to, content);
    },
    async listFiles(
      dirPath: string,
    ): Promise<ReadonlyArray<{ name: string; path: string; isDirectory: boolean }>> {
      return [
        { name: 'file1.txt', path: `${dirPath}/file1.txt`, isDirectory: false },
        { name: 'subdir', path: `${dirPath}/subdir`, isDirectory: true },
      ];
    },
    async searchFiles(pattern: string): Promise<ReadonlyArray<string>> {
      return [`/test/${pattern}`];
    },
    async searchText(
      query: string,
      _pathPattern?: string,
    ): Promise<ReadonlyArray<{ path: string; line: number; match: string }>> {
      return [{ path: '/test/file.txt', line: 1, match: query }];
    },
  };
}

describe('FilesystemToolAdapter descriptor', () => {
  it('has the correct tool id', () => {
    expect(filesystemDescriptor.id).toBe(asToolId('nova.tool.filesystem'));
  });

  it('declares fs.read, fs.write, and fs.delete permissions', () => {
    expect(filesystemDescriptor.permissions).toContain('fs.read');
    expect(filesystemDescriptor.permissions).toContain('fs.write');
    expect(filesystemDescriptor.permissions).toContain('fs.delete');
  });

  it('exposes capabilities with all filesystem actions', () => {
    const caps = filesystemDescriptor.capabilities;
    const allActions = caps.flatMap((c) => c.actions);
    expect(allActions).toContain('files.list');
    expect(allActions).toContain('files.read');
    expect(allActions).toContain('files.write');
    expect(allActions).toContain('files.create');
    expect(allActions).toContain('files.rename');
    expect(allActions).toContain('files.delete');
    expect(allActions).toContain('search.files');
    expect(allActions).toContain('search.text');
  });
});

describe('FilesystemToolAdapter operations', () => {
  it('reads a file', async () => {
    const bus = makeBus();
    const fs = makeFS();
    await fs.writeFile('/test/hello.txt', 'world');
    const adapter = new FilesystemToolAdapter(fs);
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: ['fs.read', 'fs.write', 'fs.delete'],
    });
    manager.register(filesystemDescriptor, adapter);
    await manager.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });

    const result = await manager.invoke({
      toolId: FILESYSTEM_TOOL_ID,
      action: 'files.read',
      input: { path: '/test/hello.txt' },
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(true);
    expect((result.output as any)?.content).toBe('world');
  });

  it('writes a file', async () => {
    const bus = makeBus();
    const fs = makeFS();
    const adapter = new FilesystemToolAdapter(fs);
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: ['fs.read', 'fs.write', 'fs.delete'],
    });
    manager.register(filesystemDescriptor, adapter);
    await manager.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });

    const result = await manager.invoke({
      toolId: FILESYSTEM_TOOL_ID,
      action: 'files.write',
      input: { path: '/test/new.txt', content: 'new content' },
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(true);

    const readResult = await fs.readFile('/test/new.txt');
    expect(readResult).toBe('new content');
  });

  it('lists files in a directory', async () => {
    const bus = makeBus();
    const fs = makeFS();
    const adapter = new FilesystemToolAdapter(fs);
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: ['fs.read', 'fs.write', 'fs.delete'],
    });
    manager.register(filesystemDescriptor, adapter);
    await manager.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });

    const result = await manager.invoke({
      toolId: FILESYSTEM_TOOL_ID,
      action: 'files.list',
      input: { dirPath: '/test' },
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(true);
    expect(result.output as any).toHaveLength(2);
  });

  it('creates a file', async () => {
    const bus = makeBus();
    const fs = makeFS();
    const adapter = new FilesystemToolAdapter(fs);
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: ['fs.read', 'fs.write', 'fs.delete'],
    });
    manager.register(filesystemDescriptor, adapter);
    await manager.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });

    const result = await manager.invoke({
      toolId: FILESYSTEM_TOOL_ID,
      action: 'files.create',
      input: { path: '/test/created.txt', content: 'created content' },
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(true);
    const content = await fs.readFile('/test/created.txt');
    expect(content).toBe('created content');
  });

  it('renames a file', async () => {
    const bus = makeBus();
    const fs = makeFS();
    await fs.writeFile('/test/old.txt', 'content');
    const adapter = new FilesystemToolAdapter(fs);
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: ['fs.read', 'fs.write', 'fs.delete'],
    });
    manager.register(filesystemDescriptor, adapter);
    await manager.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });

    const result = await manager.invoke({
      toolId: FILESYSTEM_TOOL_ID,
      action: 'files.rename',
      input: { from: '/test/old.txt', to: '/test/new.txt' },
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(true);
    await expect(fs.readFile('/test/new.txt')).resolves.toBe('content');
  });

  it('deletes a file', async () => {
    const bus = makeBus();
    const fs = makeFS();
    await fs.writeFile('/test/to-delete.txt', 'bye');
    const adapter = new FilesystemToolAdapter(fs);
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: ['fs.read', 'fs.write', 'fs.delete'],
    });
    manager.register(filesystemDescriptor, adapter);
    await manager.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });

    const result = await manager.invoke({
      toolId: FILESYSTEM_TOOL_ID,
      action: 'files.delete',
      input: { path: '/test/to-delete.txt' },
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(true);
    await expect(fs.readFile('/test/to-delete.txt')).rejects.toThrow();
  });

  it('searches files by name', async () => {
    const bus = makeBus();
    const fs = makeFS();
    const adapter = new FilesystemToolAdapter(fs);
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: ['fs.read'],
    });
    manager.register(filesystemDescriptor, adapter);
    await manager.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });

    const result = await manager.invoke({
      toolId: FILESYSTEM_TOOL_ID,
      action: 'search.files',
      input: { pattern: '*.ts' },
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(true);
    expect((result.output as any)?.matches).toContain('/test/*.ts');
  });

  it('returns action-not-found for unknown actions', async () => {
    const bus = makeBus();
    const fs = makeFS();
    const adapter = new FilesystemToolAdapter(fs);
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: ['fs.read'],
    });
    manager.register(filesystemDescriptor, adapter);
    await manager.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });

    const result = await manager.invoke({
      toolId: FILESYSTEM_TOOL_ID,
      action: 'files.invalid',
      input: {},
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('action-not-found');
  });
});
