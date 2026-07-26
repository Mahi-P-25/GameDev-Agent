import { InMemoryEventBus } from '@gamedev-agent/events';
import { RootLogger } from '@gamedev-agent/logging';
import { describe, expect, it } from 'vitest';
import { BuildProvider } from './BuildProvider';
import { GitProvider } from './GitProvider';
import { PackageProvider } from './PackageProvider';
import { Runtime } from './Runtime';
import { GitStatus } from './RuntimeEvents';
import { TerminalProvider } from './TerminalProvider';
import { TestProvider } from './TestProvider';
import { type ExecResult, browserExecutor } from './executor';

const ROOT = 'C:/workspace/game';

/** A deterministic fake executor that returns scripted results per command. */
class FakeExecutor {
  private readonly scripts: Map<string, ExecResult> = new Map();
  readonly spawned: Array<{ command: string; args: ReadonlyArray<string> }> = [];

  script(command: string, result: Partial<ExecResult>): this {
    this.scripts.set(command, { exitCode: 0, stdout: '', stderr: '', ...result });
    return this;
  }

  async exec(command: string, args: ReadonlyArray<string>): Promise<ExecResult> {
    this.spawned.push({ command, args });
    const byArgs = this.scripts.get(args.join(' '));
    const byFirst = this.scripts.get(args[0] ?? command);
    return byArgs ?? byFirst ?? { exitCode: 0, stdout: '', stderr: '' };
  }
}

describe('runtime providers (truthful, no fabrication)', () => {
  it('GitProvider publishes git.status with real observed branch/dirty', async () => {
    const bus = new InMemoryEventBus('test');
    const events: unknown[] = [];
    bus.subscribe(GitStatus, (e) => {
      events.push(e.payload);
    });

    const git = new GitProvider({ workspaceRoot: ROOT, bus });

    // Simulate a real `git` environment via a fake executor.
    const fake = new FakeExecutor()
      .script('rev-parse --is-inside-work-tree', { stdout: 'true' })
      .script('rev-parse --abbrev-ref HEAD', { stdout: 'feature/x' })
      .script('status --porcelain=v1 --branch', {
        stdout: '## feature/x...origin/feature/x [ahead 1]\n M src/a.ts\n?? b.ts',
      });
    // Rebind the executor: GitProvider reads options.executor at construction, so
    // construct with the fake directly.
    const gitFake = new GitProvider({ workspaceRoot: ROOT, bus, executor: fake as never });

    const status = await gitFake.refresh();
    expect(status.branch).toBe('feature/x');
    expect(status.dirty).toBe(true);

    const published = bus.history().filter((e) => e.definition.type === 'git.status');
    expect(published.length).toBeGreaterThan(0);
    const payload = published[0]?.payload as { branch: string; dirty: boolean };
    expect(payload.branch).toBe('feature/x');
    expect(payload.dirty).toBe(true);
    void git;
    void events;
  });

  it('GitProvider only commits when git succeeds (truthful success)', async () => {
    const bus = new InMemoryEventBus('test');
    const fake = new FakeExecutor()
      .script('rev-parse --is-inside-work-tree', { stdout: 'true' })
      .script('rev-parse --abbrev-ref HEAD', { stdout: 'main' })
      .script('status --porcelain=v1 --branch', { stdout: '## main' })
      .script('add -A', { stdout: '' })
      .script('commit -m Ship it', { stdout: '' })
      .script('rev-parse HEAD', { stdout: 'abc123def' })
      .script('log -1 --pretty=%an', { stdout: 'Nova' });
    const git = new GitProvider({ workspaceRoot: ROOT, bus, executor: fake as never });
    const hash = await git.commit('Ship it');
    expect(hash).toBeTruthy();
    const commits = bus.history().filter((e) => e.definition.type === 'git.commit');
    expect(commits.length).toBe(1);
    const payload = commits[0]?.payload as { message: string; branch: string };
    expect(payload.message).toBe('Ship it');
    expect(payload.branch).toBe('main');
  });

  it('BuildProvider emits build.failed with real stderr when exit != 0', async () => {
    const bus = new InMemoryEventBus('test');
    const fake = new FakeExecutor().script('run', {
      exitCode: 1,
      stderr: 'TS2304: cannot find name',
    });
    const build = new BuildProvider({
      workspaceRoot: ROOT,
      bus,
      command: 'npm',
      args: ['run', 'build'],
      executor: fake as never,
    });
    const result = await build.run('default');
    expect(result.failed).toBe(true);
    const failures = bus.history().filter((e) => e.definition.type === 'build.failed');
    expect(failures.length).toBe(1);
    const payload = failures[0]?.payload as { failureReason: string };
    expect(payload.failureReason).toContain('cannot find name');
  });

  it('TestProvider emits test.failed with parsed counts', async () => {
    const bus = new InMemoryEventBus('test');
    const fake = new FakeExecutor().script('test', {
      exitCode: 1,
      stdout: '3 passed\n2 failed',
    });
    const test = new TestProvider({
      workspaceRoot: ROOT,
      bus,
      command: 'npm',
      args: ['test'],
      executor: fake as never,
    });
    const result = await test.run();
    expect(result.failed).toBe(2);
    expect(result.passed).toBe(3);
    const failures = bus.history().filter((e) => e.definition.type === 'test.failed');
    expect(failures.length).toBe(1);
  });

  it('PackageProvider detects manager from lockfile and emits package.installed', async () => {
    const bus = new InMemoryEventBus('test');
    const fake = new FakeExecutor().script('install', { stdout: 'added 12 packages' });
    const pkg = new PackageProvider({ workspaceRoot: ROOT, bus, executor: fake as never });
    // Force-detect via a stubbed lockfile check by spying the method.
    pkg.detectManager = ((): 'pnpm' => 'pnpm') as never;
    const ok = await pkg.install();
    expect(ok).toBe(true);
    const installs = bus.history().filter((e) => e.definition.type === 'package.installed');
    expect(installs.length).toBe(1);
  });

  it('TerminalProvider emits session start + end with real exit code', async () => {
    const bus = new InMemoryEventBus('test');
    const fake = new FakeExecutor().script('echo', { exitCode: 0, stdout: 'hi' });
    const term = new TerminalProvider({ workspaceRoot: ROOT, bus, executor: fake as never });
    const code = await term.open('echo', ['hi']);
    expect(code).toBe(0);
    const ended = bus.history().filter((e) => e.definition.type === 'terminal.session-ended');
    expect(ended.length).toBe(1);
    const payload = ended[0]?.payload as { exitCode: number | null };
    expect(payload.exitCode).toBe(0);
  });

  it('browser executor refuses to spawn (architecture boundary)', () => {
    const exec = browserExecutor();
    expect(() => exec.exec('git', ['status'], { cwd: ROOT })).toThrow();
  });

  it('Runtime aggregates providers and exposes truthful awareness', async () => {
    const bus = new InMemoryEventBus('test');
    const fake = new FakeExecutor()
      .script('rev-parse --is-inside-work-tree', { stdout: 'true' })
      .script('rev-parse --abbrev-ref HEAD', { stdout: 'dev' })
      .script('status --porcelain=v1 --branch', { stdout: '## dev' })
      .script('install', { stdout: 'ok' });
    const runtime = new Runtime({
      workspaceRoot: ROOT,
      bus,
      executor: fake as never,
      logger: new RootLogger('test', []),
    });
    const awareness = await runtime.awareness();
    expect(awareness.branch).toBe('dev');
    // Package manager is 'unknown' here because no lockfile exists in the fake.
    expect(awareness.packageManager).toBe('unknown');
    expect(runtime.getProviders().length).toBe(8);
    runtime.dispose();
  });
});
