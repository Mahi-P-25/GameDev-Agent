import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { BaseProvider } from './BaseProvider';
import { TerminalSessionEnded, TerminalSessionStarted } from './RuntimeEvents';
import type { ProcessExecutor } from './executor';
import type { ProviderCapability, ProviderStatus } from './types';

/** Capability ids owned by the Terminal provider. */
export type TerminalCapabilityId = 'terminal.spawn';

export interface TerminalProviderStatus extends ProviderStatus {
  readonly sessions: number;
}

/** A live terminal session handle. */
export interface TerminalSession {
  readonly sessionId: string;
  readonly command: string;
}

/**
 * Runs real terminal sessions via the {@link ProcessExecutor} and surfaces them
 * as `terminal.session-started` / `terminal.session-ended` Studio Events. It
 * never fakes a session: a session exists only because a real process started
 * and ended with the exit code it actually returned.
 *
 * In the browser build the executor refuses to spawn, so `open()` throws a
 * truthful error rather than pretending a shell exists.
 */
export class TerminalProvider extends BaseProvider<TerminalProviderStatus, TerminalCapabilityId> {
  readonly id = 'nova.runtime.terminal';
  readonly name = 'Terminal';

  private readonly bus: EventBusContract;
  private readonly workspaceRoot: string;
  private nextId = 0;

  constructor(options: {
    workspaceRoot: string;
    bus: EventBusContract;
    executor?: ProcessExecutor;
    logger?: Logger;
  }) {
    super(
      BaseProvider.resolveOptions({
        executor: options.executor,
        logger: options.logger?.child('terminal'),
      }),
    );
    this.bus = options.bus;
    this.workspaceRoot = options.workspaceRoot;
  }

  protected initialStatus(): TerminalProviderStatus {
    return { state: 'ready', health: 'up', observedAt: Date.now(), sessions: 0 };
  }

  protected capabilities(): ReadonlyArray<
    ProviderCapability & { readonly id: TerminalCapabilityId }
  > {
    return [{ id: 'terminal.spawn', label: 'Open terminal sessions', available: true }];
  }

  /**
   * Open a real session: run `command` and await its true exit code, publishing
   * start/end events. Resolves with the real exit code.
   */
  async open(command: string, args: ReadonlyArray<string> = []): Promise<number | null> {
    const sessionId = `sess-${Date.now()}-${this.nextId}`;
    this.nextId += 1;
    this.status = { ...this.status, sessions: this.status.sessions + 1 };

    await this.bus.publish(TerminalSessionStarted, {
      workspaceRoot: this.workspaceRoot,
      correlationId: null,
      timestamp: Date.now(),
      sessionId,
      command: [command, ...args].join(' '),
    });

    const result = await this.executor.exec(command, args, { cwd: this.workspaceRoot });

    await this.bus.publish(TerminalSessionEnded, {
      workspaceRoot: this.workspaceRoot,
      correlationId: null,
      timestamp: Date.now(),
      sessionId,
      exitCode: result.exitCode,
      command: [command, ...args].join(' '),
    });
    return result.exitCode;
  }

  async refresh(): Promise<TerminalProviderStatus> {
    return this.status;
  }
}
