import type { EventBusContract } from '@gamedev-agent/events';
import { BaseProvider } from './BaseProvider';
import { ProcessExited, ProcessSpawned } from './RuntimeEvents';
import type { ProviderCapability, ProviderStatus } from './types';

/** Capability ids owned by the Process provider. */
export type ProcessCapabilityId = 'process.spawn';

export interface ProcessProviderStatus extends ProviderStatus {
  readonly tracked: number;
}

/**
 * Observes real OS processes spawned through the Runtime. It does not spawn
 * processes itself — {@link Runtime} (or a Terminal session) does — but every
 * spawn/exi is recorded as a `process.spawned` / `process.exited` Studio Event
 * so the Studio can show live terminal/process activity truthfully.
 */
export class ProcessProvider extends BaseProvider<ProcessProviderStatus, ProcessCapabilityId> {
  readonly id = 'nova.runtime.process';
  readonly name = 'Process';

  private readonly bus: EventBusContract;

  constructor(options: {
    bus: EventBusContract;
    logger?: import('@gamedev-agent/logging').Logger;
  }) {
    super(BaseProvider.resolveOptions({ logger: options.logger?.child('process') }));
    this.bus = options.bus;
  }

  protected initialStatus(): ProcessProviderStatus {
    return { state: 'ready', health: 'up', observedAt: Date.now(), tracked: 0 };
  }

  protected capabilities(): ReadonlyArray<
    ProviderCapability & { readonly id: ProcessCapabilityId }
  > {
    return [{ id: 'process.spawn', label: 'Track spawned processes', available: true }];
  }

  /** Record (and publish) a process spawn. Returns the event payload. */
  async notifySpawn(input: {
    workspaceRoot: string;
    pid: number;
    command: string;
    args: ReadonlyArray<string>;
  }): Promise<void> {
    this.status = { ...this.status, tracked: this.status.tracked + 1 };
    await this.bus.publish(ProcessSpawned, {
      workspaceRoot: input.workspaceRoot,
      correlationId: null,
      timestamp: Date.now(),
      pid: input.pid,
      command: input.command,
      args: input.args,
    });
  }

  /** Record (and publish) a process exit. */
  async notifyExit(input: {
    workspaceRoot: string;
    pid: number;
    exitCode: number | null;
  }): Promise<void> {
    await this.bus.publish(ProcessExited, {
      workspaceRoot: input.workspaceRoot,
      correlationId: null,
      timestamp: Date.now(),
      pid: input.pid,
      exitCode: input.exitCode,
    });
  }

  async refresh(): Promise<ProcessProviderStatus> {
    return this.status;
  }
}
