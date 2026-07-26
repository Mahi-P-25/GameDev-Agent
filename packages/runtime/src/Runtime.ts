import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import type { Disposable } from '@gamedev-agent/shared';
import { BuildProvider } from './BuildProvider';
import { FilesystemProvider } from './FilesystemProvider';
import { GitProvider } from './GitProvider';
import { PackageProvider } from './PackageProvider';
import { ProcessProvider } from './ProcessProvider';
import { TerminalProvider } from './TerminalProvider';
import { TestProvider } from './TestProvider';
import { WorkspaceProvider } from './WorkspaceProvider';
import { type ProcessExecutor, browserExecutor, nullLogger } from './executor';
import type { ProviderStatus } from './types';
import type { ProviderHealth, RuntimeProvider } from './types';

/** Build/test/package command descriptors truthfully derived from the workspace. */
export interface RuntimeBuildConfig {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
}
export interface RuntimeTestConfig {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
}

/**
 * The composed **Runtime** — Nova's truthful window into the development
 * environment.
 *
 * It owns one provider per concern (Git, Terminal, Filesystem, Workspace,
 * Build, Test, Package, Process) and exposes:
 *  - `providers`         — the live provider list (each with status/health/
 *                           capabilities) for the UI and health summaries.
 *  - `awareness()`       — a single truthful Workspace snapshot.
 *  - command actions      — `runTests`, `restartBuild`, `commit`, `install`,
 *                           `openTerminal` — all executed *through* the providers,
 *                           so every side effect becomes a real Studio Event.
 *
 * Agents (and the Command Center) MUST go through this surface, never calling
 * Git/Terminal/Build directly. That keeps the architecture modular and every
 * action truthful and event-sourced.
 */
export class Runtime implements Disposable {
  readonly git: GitProvider;
  readonly terminal: TerminalProvider;
  readonly filesystem: FilesystemProvider;
  readonly workspace: WorkspaceProvider;
  readonly build: BuildProvider;
  readonly test: TestProvider;
  readonly pkg: PackageProvider;
  readonly process: ProcessProvider;

  private readonly bus: EventBusContract;
  private readonly disposables: ReadonlyArray<Disposable>;

  constructor(options: {
    workspaceRoot: string;
    bus: EventBusContract;
    executor?: ProcessExecutor;
    logger?: Logger;
    buildConfig?: RuntimeBuildConfig;
    testConfig?: RuntimeTestConfig;
  }) {
    const executor = options.executor ?? browserExecutor();
    const logger = options.logger ?? nullLogger();
    this.bus = options.bus;

    this.git = new GitProvider({
      workspaceRoot: options.workspaceRoot,
      bus: this.bus,
      executor,
      logger,
    });
    this.terminal = new TerminalProvider({
      workspaceRoot: options.workspaceRoot,
      bus: this.bus,
      executor,
      logger,
    });
    this.filesystem = new FilesystemProvider({
      workspaceRoot: options.workspaceRoot,
      bus: this.bus,
      logger,
    });
    this.pkg = new PackageProvider({
      workspaceRoot: options.workspaceRoot,
      bus: this.bus,
      executor,
      logger,
    });
    const buildConfig = options.buildConfig ?? { command: 'npm', args: ['run', 'build'] };
    this.build = new BuildProvider({
      workspaceRoot: options.workspaceRoot,
      bus: this.bus,
      command: buildConfig.command,
      args: buildConfig.args,
      executor,
      logger,
    });
    const testConfig = options.testConfig ?? { command: 'npm', args: ['test'] };
    this.test = new TestProvider({
      workspaceRoot: options.workspaceRoot,
      bus: this.bus,
      command: testConfig.command,
      args: testConfig.args,
      executor,
      logger,
    });
    this.process = new ProcessProvider({ bus: this.bus, logger });
    this.workspace = new WorkspaceProvider({
      workspaceRoot: options.workspaceRoot,
      bus: this.bus,
      git: this.git,
      build: this.build,
      test: this.test,
      pkg: this.pkg,
      logger,
    });

    this.disposables = [
      this.git,
      this.terminal,
      this.filesystem,
      this.workspace,
      this.build,
      this.test,
      this.pkg,
      this.process,
    ];
  }

  /** Every live provider, for health/status surfacing. */
  getProviders(): ReadonlyArray<RuntimeProvider<ProviderStatus, string>> {
    return [
      this.git,
      this.terminal,
      this.filesystem,
      this.workspace,
      this.build,
      this.test,
      this.pkg,
      this.process,
    ];
  }

  /** Coarse overall health: down if any provider is down, degraded if any degraded. */
  getHealth(): ProviderHealth {
    const states = this.getProviders().map((p) => p.getHealth());
    if (states.includes('down')) {
      return 'down';
    }
    if (states.includes('degraded')) {
      return 'degraded';
    }
    if (states.includes('unknown')) {
      return 'unknown';
    }
    return 'up';
  }

  /**
   * A single, truthful workspace-awareness snapshot for the Studio UI. Derived
   * entirely from real provider state — never assumed.
   */
  async awareness(): Promise<{
    readonly workspaceRoot: string;
    readonly branch: string | null;
    readonly dirty: boolean;
    readonly packageManager: string;
    readonly buildState: string | null;
    readonly testState: string | null;
    readonly lastOpenedFile: string | null;
    readonly health: ProviderHealth;
  }> {
    await this.git.refresh();
    const ws = await this.workspace.refresh();
    return {
      workspaceRoot: this.git.getStatus().repoRoot ?? '',
      branch: this.git.getBranch(),
      dirty: this.git.isDirty(),
      packageManager: ws.packageManager,
      buildState: ws.buildState,
      testState: ws.testState,
      lastOpenedFile: this.filesystem.getLastOpened(),
      health: this.getHealth(),
    };
  }

  // --- command actions (all truthful, all event-sourced) --------------------

  /** Run the project's real test command. */
  runTests(): Promise<{ exitCode: number; passed: number; failed: number; total: number }> {
    return this.test.run();
  }

  /** Restart the project's real build. */
  restartBuild(): Promise<{ exitCode: number; failed: boolean }> {
    return this.build.run('default');
  }

  /** Create a real git commit (stages all + commits with the given message). */
  commit(message: string): Promise<string> {
    return this.git.commit(message);
  }

  /** Install dependencies via the detected package manager. */
  install(spec = 'install'): Promise<boolean> {
    return this.pkg.install(spec);
  }

  /** Open a real terminal session. */
  openTerminal(command: string, args: ReadonlyArray<string> = []): Promise<number | null> {
    return this.terminal.open(command, args);
  }

  /** Re-observe the whole environment truthfully. */
  async refreshAll(): Promise<void> {
    await Promise.all([this.git.refresh(), this.pkg.refresh(), this.workspace.refresh()]);
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
