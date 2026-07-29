import type { EventBusContract, EventDefinition } from '@gamedev-agent/events';
import type { ExecOptions, ExecResult, ProcessExecutor } from '@gamedev-agent/runtime';
import { GitProvider } from '@gamedev-agent/runtime';
import type { Json } from '@gamedev-agent/shared';
import { describe, expect, it } from 'vitest';
import { GIT_TOOL_ID, GitToolAdapter, gitDescriptor } from './GitToolAdapter';
import { ToolManager } from './ToolManager';
import { asToolId } from './ToolTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBus(): EventBusContract & { published: Array<{ type: string; payload: unknown }> } {
  const published: Array<{ type: string; payload: unknown }> = [];
  return {
    published,
    async publish<T>(definition: EventDefinition<T>, payload: T): Promise<void> {
      published.push({ type: definition.type, payload });
    },
    subscribe: () => () => {},
    on: () => () => {},
    off: () => {},
    dispose: () => {},
  } as unknown as EventBusContract & { published: Array<{ type: string; payload: unknown }> };
}

interface FakeGitCommands {
  stdout?: string;
  stderr?: string;
  exitCode: number;
}

class FakeGitExecutor implements ProcessExecutor {
  private repoInitialized = false;
  private commitCount = 0;

  exec(command: string, args: ReadonlyArray<string>, _options: ExecOptions): Promise<ExecResult> {
    if (command !== 'git') {
      return Promise.resolve({ exitCode: 1, stdout: '', stderr: `unknown command: ${command}` });
    }

    if (args.length === 0) {
      return Promise.resolve({ exitCode: 1, stdout: '', stderr: 'no args' });
    }

    switch (args[0]) {
      case 'init':
        this.repoInitialized = true;
        return resolveCmd({ exitCode: 0, stdout: 'Initialized empty Git repository' });

      case 'rev-parse':
        if (args[1] === '--is-inside-work-tree') {
          if (this.repoInitialized) {
            return resolveCmd({ exitCode: 0, stdout: 'true' });
          }
          return resolveCmd({
            exitCode: 1,
            stdout: 'false',
            stderr: 'fatal: not a git repository',
          });
        }
        if (args[1] === '--abbrev-ref') {
          return resolveCmd({ exitCode: 0, stdout: 'main' });
        }
        if (args[1] === 'HEAD') {
          return resolveCmd({
            exitCode: 0,
            stdout: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
          });
        }
        return resolveCmd({ exitCode: 1, stdout: '', stderr: 'unknown rev-parse' });

      case 'status':
        if (args[1] === '--porcelain=v1') {
          return resolveCmd({ exitCode: 0, stdout: '## main\n' });
        }
        return resolveCmd({ exitCode: 1, stdout: '', stderr: 'unknown status' });

      case 'add':
        if (args[0] === 'add' && args[1] === '-A') {
          return resolveCmd({ exitCode: 0, stdout: '' });
        }
        return resolveCmd({ exitCode: 1, stdout: '', stderr: 'unknown add' });

      case 'commit':
        this.commitCount++;
        return resolveCmd({ exitCode: 0, stdout: '1 file changed' });

      case 'log':
        if (args[1] === '-1') {
          return resolveCmd({ exitCode: 0, stdout: 'Test Author' });
        }
        return resolveCmd({ exitCode: 1, stdout: '', stderr: 'unknown log' });

      default:
        return resolveCmd({ exitCode: 1, stdout: '', stderr: `unknown git command: ${args[0]}` });
    }
  }
}

function resolveCmd(cmd: FakeGitCommands): Promise<ExecResult> {
  return Promise.resolve({
    exitCode: cmd.exitCode,
    stdout: cmd.stdout ?? '',
    stderr: cmd.stderr ?? '',
  });
}

function makeManager(options?: {
  grantedPermissions?: ReadonlyArray<string>;
}): ToolManager {
  const bus = makeBus();
  return new ToolManager({
    eventBus: bus,
    platform: 'win32',
    grantedPermissions: options?.grantedPermissions ?? ['fs.read', 'process.spawn'],
  });
}

function makeAdapter(): { adapter: GitToolAdapter; provider: GitProvider; manager: ToolManager } {
  const provider = new GitProvider({
    workspaceRoot: '/fake/project',
    bus: makeBus(),
    executor: new FakeGitExecutor(),
  });
  const adapter = new GitToolAdapter(provider);
  const manager = makeManager();
  manager.register(gitDescriptor, adapter);
  return { adapter, provider, manager };
}

// ---------------------------------------------------------------------------
// Tool descriptor and capability shape
// ---------------------------------------------------------------------------

describe('GitToolAdapter descriptor', () => {
  it('has the correct tool id', () => {
    expect(gitDescriptor.id).toBe(asToolId('nova.tool.git'));
  });

  it('categorises as vcs', () => {
    expect(gitDescriptor.category).toBe('vcs');
  });

  it('declares process.spawn and fs.read permissions', () => {
    expect(gitDescriptor.permissions).toContain('process.spawn');
    expect(gitDescriptor.permissions).toContain('fs.read');
  });

  it('exposes three capabilities with the correct actions', () => {
    const caps = gitDescriptor.capabilities;
    const allActions = caps.flatMap((c) => c.actions);
    expect(allActions).toContain('git.init');
    expect(allActions).toContain('git.status');
    expect(allActions).toContain('git.commit');
    expect(allActions).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Registration and connection
// ---------------------------------------------------------------------------

describe('GitToolAdapter registration + connection', () => {
  it('registers as nova.tool.git', () => {
    const { manager } = makeAdapter();
    expect(manager.list()).toHaveLength(1);
    expect(manager.get(GIT_TOOL_ID)).toBeDefined();
  });

  it('connects and reports connected', async () => {
    const { manager } = makeAdapter();
    expect(manager.isConnected(GIT_TOOL_ID)).toBe(false);
    await manager.connect(GIT_TOOL_ID, { kind: 'director' });
    expect(manager.isConnected(GIT_TOOL_ID)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// git.init
// ---------------------------------------------------------------------------

describe('git.init', () => {
  it('initialises a git repository when connected', async () => {
    const { manager } = makeAdapter();
    await manager.connect(GIT_TOOL_ID, { kind: 'director' });

    const result = await manager.invoke({
      toolId: GIT_TOOL_ID,
      action: 'git.init',
      input: {} as Json,
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(true);
    expect(result.output).toMatchObject({ repoRoot: '/fake/project' });
  });

  it('fails when not connected', async () => {
    const { manager } = makeAdapter();

    const result = await manager.invoke({
      toolId: GIT_TOOL_ID,
      action: 'git.init',
      input: {} as Json,
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('not-connected');
  });

  it('denies invocation when process.spawn permission is missing', async () => {
    const bus = makeBus();
    const provider = new GitProvider({
      workspaceRoot: '/fake/project',
      bus: makeBus(),
      executor: new FakeGitExecutor(),
    });
    const adapter = new GitToolAdapter(provider);
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: ['fs.read'],
    });
    manager.register(gitDescriptor, adapter);
    await manager.connect(GIT_TOOL_ID, { kind: 'director' });

    const result = await manager.invoke({
      toolId: GIT_TOOL_ID,
      action: 'git.init',
      input: {} as Json,
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('permission-denied');
  });
});

// ---------------------------------------------------------------------------
// git.status
// ---------------------------------------------------------------------------

describe('git.status', () => {
  it('returns repository status after init', async () => {
    const { manager } = makeAdapter();
    await manager.connect(GIT_TOOL_ID, { kind: 'director' });

    // Init first so the repo exists
    await manager.invoke({
      toolId: GIT_TOOL_ID,
      action: 'git.init',
      input: {} as Json,
      actor: { kind: 'director' },
      correlationId: null,
    });

    const result = await manager.invoke({
      toolId: GIT_TOOL_ID,
      action: 'git.status',
      input: {} as Json,
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(true);
    expect(result.output).toMatchObject({
      branch: 'main',
      dirty: false,
      repoRoot: '/fake/project',
    });
  });

  it('denies invocation when fs.read permission is missing', async () => {
    const bus = makeBus();
    const provider = new GitProvider({
      workspaceRoot: '/fake/project',
      bus: makeBus(),
      executor: new FakeGitExecutor(),
    });
    const adapter = new GitToolAdapter(provider);
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: ['process.spawn'],
    });
    manager.register(gitDescriptor, adapter);
    await manager.connect(GIT_TOOL_ID, { kind: 'director' });

    const result = await manager.invoke({
      toolId: GIT_TOOL_ID,
      action: 'git.status',
      input: {} as Json,
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('permission-denied');
  });
});

// ---------------------------------------------------------------------------
// git.commit
// ---------------------------------------------------------------------------

describe('git.commit', () => {
  it('creates a commit with the given message', async () => {
    const { manager } = makeAdapter();
    await manager.connect(GIT_TOOL_ID, { kind: 'director' });

    // Init first
    await manager.invoke({
      toolId: GIT_TOOL_ID,
      action: 'git.init',
      input: {} as Json,
      actor: { kind: 'director' },
      correlationId: null,
    });

    const result = await manager.invoke({
      toolId: GIT_TOOL_ID,
      action: 'git.commit',
      input: { message: 'Initial commit' } as Json,
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(true);
    expect(result.output).toMatchObject({
      hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      message: 'Initial commit',
    });
  });

  it('uses a default message when none is provided', async () => {
    const { manager } = makeAdapter();
    await manager.connect(GIT_TOOL_ID, { kind: 'director' });

    await manager.invoke({
      toolId: GIT_TOOL_ID,
      action: 'git.init',
      input: {} as Json,
      actor: { kind: 'director' },
      correlationId: null,
    });

    const result = await manager.invoke({
      toolId: GIT_TOOL_ID,
      action: 'git.commit',
      input: {} as Json,
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(true);
    expect(result.output).toMatchObject({ message: 'Nova commit' });
  });

  it('denies invocation when process.spawn permission is missing', async () => {
    const bus = makeBus();
    const provider = new GitProvider({
      workspaceRoot: '/fake/project',
      bus: makeBus(),
      executor: new FakeGitExecutor(),
    });
    const adapter = new GitToolAdapter(provider);
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: ['fs.read'],
    });
    manager.register(gitDescriptor, adapter);
    await manager.connect(GIT_TOOL_ID, { kind: 'director' });

    const result = await manager.invoke({
      toolId: GIT_TOOL_ID,
      action: 'git.commit',
      input: { message: 'test' } as Json,
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('permission-denied');
  });
});

// ---------------------------------------------------------------------------
// Unknown action
// ---------------------------------------------------------------------------

describe('unknown action', () => {
  it('returns action-not-found for an unrecognised action', async () => {
    const { manager } = makeAdapter();
    await manager.connect(GIT_TOOL_ID, { kind: 'director' });

    const result = await manager.invoke({
      toolId: GIT_TOOL_ID,
      action: 'git.push',
      input: {} as Json,
      actor: { kind: 'director' },
      correlationId: null,
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('action-not-found');
  });
});

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

describe('audit trail', () => {
  it('records git.init in the audit trail on success', async () => {
    const { manager } = makeAdapter();
    await manager.connect(GIT_TOOL_ID, { kind: 'director' });

    await manager.invoke({
      toolId: GIT_TOOL_ID,
      action: 'git.init',
      input: {} as Json,
      actor: { kind: 'director' },
      correlationId: null,
    });

    const audit = manager.auditTrail();
    const initRecord = audit.find((r) => r.action === 'git.init');
    expect(initRecord).toBeDefined();
    expect(initRecord?.ok).toBe(true);
    expect(initRecord?.toolId).toBe(GIT_TOOL_ID);
  });

  it('records git.commit in the audit trail on success', async () => {
    const { manager } = makeAdapter();
    await manager.connect(GIT_TOOL_ID, { kind: 'director' });
    await manager.invoke({
      toolId: GIT_TOOL_ID,
      action: 'git.init',
      input: {} as Json,
      actor: { kind: 'director' },
      correlationId: null,
    });

    await manager.invoke({
      toolId: GIT_TOOL_ID,
      action: 'git.commit',
      input: { message: 'test' } as Json,
      actor: { kind: 'director' },
      correlationId: null,
    });

    const audit = manager.auditTrail();
    const commitRecord = audit.find((r) => r.action === 'git.commit');
    expect(commitRecord).toBeDefined();
    expect(commitRecord?.ok).toBe(true);
  });

  it('records permission-denied in the audit trail', async () => {
    const bus = makeBus();
    const provider = new GitProvider({
      workspaceRoot: '/fake/project',
      bus: makeBus(),
      executor: new FakeGitExecutor(),
    });
    const adapter = new GitToolAdapter(provider);
    const manager = new ToolManager({
      eventBus: bus,
      platform: 'win32',
      grantedPermissions: [],
    });
    manager.register(gitDescriptor, adapter);
    await manager.connect(GIT_TOOL_ID, { kind: 'director' });

    await manager.invoke({
      toolId: GIT_TOOL_ID,
      action: 'git.init',
      input: {} as Json,
      actor: { kind: 'director' },
      correlationId: null,
    });

    const audit = manager.auditTrail();
    const deniedRecord = audit.find((r) => r.error?.includes('permission'));
    expect(deniedRecord).toBeDefined();
    expect(deniedRecord?.ok).toBe(false);
  });
});
