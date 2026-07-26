import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compileGlob } from './SearchService';
import {
  VSCodeAlreadyExistsError,
  VSCodeClient,
  VSCodeFileCreatedEvent,
  VSCodeFileWritten,
  VSCodeNotFoundError,
  VSCodePathTraversalError,
  VSCodeRejectedError,
  VSCodeWorkspaceClosedError,
  VSCodeWorkspaceFileChanged,
  VSCodeWorkspaceOpenError,
  VSCodeWorkspaceOpened,
} from './index';
import { TestBus, deterministicId, withTempDir } from './test_helpers';

const ACTOR = { kind: 'director' } as const;

describe('VSCodeClient — workspace loading', () => {
  let bus: TestBus;
  let client: VSCodeClient;
  let temp: Awaited<ReturnType<typeof withTempDir>>;

  beforeEach(async () => {
    bus = new TestBus();
    client = new VSCodeClient({ eventBus: bus, idGenerator: deterministicId });
    temp = await withTempDir();
  });
  afterEach(async () => {
    client.dispose();
    await temp.cleanup();
  });

  it('opens a workspace and emits vscode.workspace-opened', async () => {
    const info = await client.openWorkspace(temp.dir, ACTOR);
    expect(info.status).toBe('open');
    expect(info.rootPath).toBe(temp.dir);
    expect(bus.ofType(VSCodeWorkspaceOpened.type)).toHaveLength(1);
  });

  it('rejects opening a non-existent path', async () => {
    await expect(client.openWorkspace(join(temp.dir, 'nope'), ACTOR)).rejects.toBeInstanceOf(
      VSCodeWorkspaceOpenError,
    );
  });

  it('rejects opening a second workspace while one is open', async () => {
    await client.openWorkspace(temp.dir, ACTOR);
    await expect(client.openWorkspace(temp.dir, ACTOR)).rejects.toBeInstanceOf(Error);
  });

  it('closes and emits vscode.workspace-closed', async () => {
    await client.openWorkspace(temp.dir, ACTOR);
    await client.closeWorkspace(ACTOR);
    expect(client.getWorkspaceInfo().status).toBe('closed');
    expect(bus.ofType('vscode.workspace-closed')).toHaveLength(1);
  });

  it('audits workspace open/close', async () => {
    await client.openWorkspace(temp.dir, ACTOR);
    await client.closeWorkspace(ACTOR);
    const kinds = client.auditTrail().map((r) => r.kind);
    expect(kinds).toContain('workspace.open');
    expect(kinds).toContain('workspace.close');
  });
});

describe('VSCodeClient — read / write', () => {
  let bus: TestBus;
  let client: VSCodeClient;
  let temp: Awaited<ReturnType<typeof withTempDir>>;

  beforeEach(async () => {
    bus = new TestBus();
    client = new VSCodeClient({ eventBus: bus, idGenerator: deterministicId });
    temp = await withTempDir();
    await client.openWorkspace(temp.dir, ACTOR);
  });
  afterEach(async () => {
    client.dispose();
    await temp.cleanup();
  });

  it('writes then reads a file', async () => {
    await client.writeFile(ACTOR, 'src/index.ts', 'console.log(1);');
    const content = await client.readFile(ACTOR, 'src/index.ts');
    expect(content.content).toBe('console.log(1);');
    expect(bus.ofType(VSCodeFileWritten.type)).toHaveLength(1);
    expect(bus.ofType('vscode.file-read')).toHaveLength(1);
  });

  it('refuses to overwrite without force', async () => {
    await client.writeFile(ACTOR, 'a.txt', 'v1');
    await expect(client.writeFile(ACTOR, 'a.txt', 'v2')).rejects.toBeInstanceOf(
      VSCodeRejectedError,
    );
  });

  it('overwrites when force is set', async () => {
    await client.writeFile(ACTOR, 'a.txt', 'v1');
    await client.writeFile(ACTOR, 'a.txt', 'v2', null, { force: true });
    expect((await client.readFile(ACTOR, 'a.txt')).content).toBe('v2');
  });

  it('creates a file and refuses to recreate it', async () => {
    await client.createFile(ACTOR, 'new.ts');
    expect(bus.ofType(VSCodeFileCreatedEvent.type)).toHaveLength(1);
    await expect(client.createFile(ACTOR, 'new.ts')).rejects.toBeInstanceOf(
      VSCodeAlreadyExistsError,
    );
  });

  it('renames and deletes files', async () => {
    await client.writeFile(ACTOR, 'old.ts', 'x');
    await client.renameFile(ACTOR, 'old.ts', 'renamed.ts');
    await client.deleteFile(ACTOR, 'renamed.ts');
    await expect(client.readFile(ACTOR, 'renamed.ts')).rejects.toBeInstanceOf(VSCodeNotFoundError);
  });

  it('lists directory children', async () => {
    await client.writeFile(ACTOR, 'a.ts', '');
    await client.writeFile(ACTOR, 'b.ts', '');
    const entries = await client.listFiles(ACTOR);
    expect(entries.map((e) => e.path).sort()).toEqual(['a.ts', 'b.ts']);
  });

  it('blocks path traversal', async () => {
    await expect(client.readFile(ACTOR, '../secret.txt')).rejects.toBeInstanceOf(
      VSCodePathTraversalError,
    );
  });

  it('rejects operations when no workspace is open', async () => {
    client.dispose();
    const fresh = new VSCodeClient({ eventBus: new TestBus(), idGenerator: deterministicId });
    await expect(fresh.readFile(ACTOR, 'a.ts')).rejects.toBeInstanceOf(VSCodeWorkspaceClosedError);
    fresh.dispose();
  });
});

describe('VSCodeClient — search', () => {
  let client: VSCodeClient;
  let temp: Awaited<ReturnType<typeof withTempDir>>;

  beforeEach(async () => {
    const bus = new TestBus();
    client = new VSCodeClient({ eventBus: bus, idGenerator: deterministicId });
    temp = await withTempDir();
    await client.openWorkspace(temp.dir, ACTOR);
    await client.writeFile(ACTOR, 'src/a.ts', 'export const alpha = 1;');
    await client.writeFile(ACTOR, 'src/b.ts', 'export const beta = 2;');
    await client.writeFile(ACTOR, 'readme.md', 'alpha note');
  });
  afterEach(async () => {
    client.dispose();
    await temp.cleanup();
  });

  it('searches files by glob', async () => {
    const matches = await client.searchFiles(ACTOR, { pattern: '**/*.ts' });
    expect(matches.map((m) => m.path).sort()).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('searches text content with line/column', async () => {
    const matches = await client.searchText(ACTOR, 'alpha');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const hit = matches.find((m) => m.path === 'src/a.ts');
    expect(hit?.line).toBe(1);
    expect(hit?.lineText).toContain('alpha');
  });

  it('respects case sensitivity', async () => {
    const insensitive = await client.searchText(ACTOR, 'ALPHA');
    expect(insensitive.length).toBeGreaterThanOrEqual(1);
    const sensitive = await client.searchText(ACTOR, 'ALPHA', { caseSensitive: true });
    expect(sensitive).toHaveLength(0);
  });
});

describe('compileGlob', () => {
  it('matches nested globs', () => {
    const m = compileGlob('**/*.ts');
    expect(m('src/a.ts')).toBe(true);
    expect(m('a.ts')).toBe(true);
    expect(m('src/a.js')).toBe(false);
  });
  it('matches literal segments', () => {
    const m = compileGlob('src/*.ts');
    expect(m('src/a.ts')).toBe(true);
    expect(m('lib/a.ts')).toBe(false);
  });
});

describe('VSCodeClient — watcher events', () => {
  let bus: TestBus;
  let client: VSCodeClient;
  let temp: Awaited<ReturnType<typeof withTempDir>>;

  beforeEach(async () => {
    bus = new TestBus();
    client = new VSCodeClient({ eventBus: bus, idGenerator: deterministicId });
    temp = await withTempDir();
    await client.openWorkspace(temp.dir, ACTOR);
  });
  afterEach(async () => {
    client.dispose();
    await temp.cleanup();
  });

  it('starts and stops the watcher, emitting lifecycle events', async () => {
    const watcher = client.startWatch(ACTOR);
    expect(watcher.active).toBe(true);
    expect(bus.ofType('vscode.watcher-started')).toHaveLength(1);
    client.stopWatch(ACTOR, null, 'test');
    expect(bus.ofType('vscode.watcher-stopped')).toHaveLength(1);
  });

  it('emits vscode.workspace-file-changed when a file is written externally', async () => {
    client.startWatch(ACTOR);
    await writeFile(join(temp.dir, 'watched.ts'), 'changed', 'utf-8');
    // Allow the fs event + debounce window to flush.
    await new Promise((resolve) => setTimeout(resolve, 300));
    const changes = bus.ofType(VSCodeWorkspaceFileChanged.type);
    client.stopWatch(ACTOR, null, 'test');
    expect(changes.some((e) => (e.payload as { path: string }).path === 'watched.ts')).toBe(true);
  });
});

describe('VSCodeClient — error handling', () => {
  it('surfaces a stable error hierarchy from fs failures', async () => {
    const bus = new TestBus();
    const client = new VSCodeClient({ eventBus: bus, idGenerator: deterministicId });
    const temp = await withTempDir();
    await client.openWorkspace(temp.dir, ACTOR);
    await expect(client.readFile(ACTOR, 'missing.txt')).rejects.toBeInstanceOf(VSCodeNotFoundError);
    await client.dispose();
    await temp.cleanup();
  });
});
