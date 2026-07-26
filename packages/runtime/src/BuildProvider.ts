import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { BaseProvider } from './BaseProvider';
import { BuildFailed, BuildStarted, BuildSucceeded } from './RuntimeEvents';
import type { ProcessExecutor } from './executor';
import type { ProviderCapability, ProviderStatus } from './types';

/** Capability ids owned by the Build provider. */
export type BuildCapabilityId = 'build.run';

export interface BuildProviderStatus extends ProviderStatus {
  readonly lastTarget: string | null;
  readonly lastState: 'started' | 'succeeded' | 'failed' | 'canceled' | null;
}

/**
 * Runs the project's real build command and publishes `build.started` /
 * `build.succeeded` / `build.failed` with the actual exit code and, when it
 * fails, the real (truncated) stderr as the reason. Nova says "Build failed"
 * only because this provider observed a non-zero exit.
 */
export class BuildProvider extends BaseProvider<BuildProviderStatus, BuildCapabilityId> {
  readonly id = 'nova.runtime.build';
  readonly name = 'Build';

  private readonly bus: EventBusContract;
  private readonly workspaceRoot: string;
  private readonly command: string;
  private readonly args: ReadonlyArray<string>;

  constructor(options: {
    workspaceRoot: string;
    bus: EventBusContract;
    /** The build command, e.g. `npm`, with args `['run','build']`. */
    command: string;
    args?: ReadonlyArray<string>;
    executor?: ProcessExecutor;
    logger?: Logger;
  }) {
    super(
      BaseProvider.resolveOptions({
        executor: options.executor,
        logger: options.logger?.child('build'),
      }),
    );
    this.bus = options.bus;
    this.workspaceRoot = options.workspaceRoot;
    this.command = options.command;
    this.args = options.args ?? [];
  }

  protected initialStatus(): BuildProviderStatus {
    return {
      state: 'ready',
      health: 'up',
      observedAt: Date.now(),
      lastTarget: null,
      lastState: null,
    };
  }

  protected capabilities(): ReadonlyArray<ProviderCapability & { readonly id: BuildCapabilityId }> {
    return [{ id: 'build.run', label: 'Run project build', available: true }];
  }

  /** Run the build. Publishes truthful start/success/failure events. */
  async run(target = 'default'): Promise<{ exitCode: number; failed: boolean }> {
    const buildId = `build-${Date.now()}`;
    const startedAt = Date.now();
    this.status = { ...this.status, lastTarget: target, lastState: 'started' };
    await this.bus.publish(BuildStarted, {
      workspaceRoot: this.workspaceRoot,
      correlationId: null,
      timestamp: startedAt,
      buildId,
      state: 'started',
      target,
    });

    const result = await this.executor.exec(this.command, this.args, { cwd: this.workspaceRoot });
    const durationMs = Date.now() - startedAt;
    const failed = result.exitCode !== 0;

    if (failed) {
      const reason = result.stderr.trim().split(/\r?\n/).slice(-5).join('\n') || 'non-zero exit';
      this.status = { ...this.status, lastState: 'failed' };
      await this.bus.publish(BuildFailed, {
        workspaceRoot: this.workspaceRoot,
        correlationId: null,
        timestamp: Date.now(),
        buildId,
        state: 'failed',
        target,
        failureReason: reason,
        durationMs,
      });
    } else {
      this.status = { ...this.status, lastState: 'succeeded' };
      await this.bus.publish(BuildSucceeded, {
        workspaceRoot: this.workspaceRoot,
        correlationId: null,
        timestamp: Date.now(),
        buildId,
        state: 'succeeded',
        target,
        durationMs,
      });
    }
    return { exitCode: result.exitCode, failed };
  }

  async refresh(): Promise<BuildProviderStatus> {
    return this.status;
  }
}
