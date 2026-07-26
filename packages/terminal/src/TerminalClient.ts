import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { Disposable, Timestamp, UUID } from '@gamedev-agent/shared';
import type { ProcessHandleCallbacks } from './ProcessHandle';
import { ProcessManager } from './ProcessManager';
import { TerminalCommandRequiredError, type TerminalError, mapSpawnError } from './TerminalErrors';
import {
  TerminalCommandCompleted,
  TerminalCommandFailed,
  TerminalCommandStarted,
  TerminalOutput,
  TerminalProcessStopped,
} from './TerminalEvents';
import type {
  CoordinatorLink,
  TerminalActor,
  TerminalAuditOperation,
  TerminalAuditRecord,
  TerminalClientOptions,
  TerminalCommandResult,
  TerminalProcessId,
  TerminalProcessInfo,
  TerminalRunOptions,
} from './TerminalTypes';

/**
 * The **TerminalClient** — the single, stable surface the rest of Nova uses to
 * execute terminal commands.
 *
 * It is the integration's façade: it owns the {@link ProcessManager}, audits
 * every execution, and publishes typed `terminal.*` events on the shared Event
 * Bus. Every public method names an explicit {@link TerminalActor} and an
 * optional `correlationId` so the action can be traced to a Mission on the
 * Coordinator / Event Bus. **The client never performs work on its own
 * initiative** — every effect is the direct result of an explicit call.
 *
 * Safety is structural, not incidental:
 *  - No command runs without an explicit request (no auto-exec, no scheduled jobs).
 *  - Every execution is audited (actor + correlationId + command line + outcome).
 *  - stdout/stderr/exit code are captured and surfaced.
 *  - Timeouts and cancellations are first-class (SIGTERM → SIGKILL).
 *
 * The client talks to the rest of Nova only through the injected
 * `EventBusContract` and the optional `CoordinatorLink`. It imports no subsystem
 * packages directly.
 */
export class TerminalClient implements Disposable {
  private readonly bus: EventBusContract;
  private readonly logger: Logger;
  private readonly coordinator: CoordinatorLink | undefined;
  private readonly manager: ProcessManager;
  private readonly idGenerator: () => string;
  private readonly cidGenerator: () => string;

  private readonly audit: Array<TerminalAuditRecord> = [];
  private seq = 0;
  private disposed = false;

  constructor(options: TerminalClientOptions) {
    this.bus = options.eventBus;
    this.logger = options.logger ?? new RootLogger('nova.terminal', [new ConsoleLogSink()]);
    this.coordinator = options.coordinator;
    this.idGenerator =
      options.idGenerator ??
      (() => `proc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`);
    this.cidGenerator = this.idGenerator;
    this.manager = new ProcessManager({
      runner: options.runner,
      logger: this.logger,
      ...(options.baseEnv !== undefined ? { baseEnv: options.baseEnv } : {}),
      ...(options.killGraceMs !== undefined ? { killGraceMs: options.killGraceMs } : {}),
    });
  }

  // --- foreground run --------------------------------------------------------

  /**
   * Execute a command in the foreground and resolve with the captured result
   * (stdout, stderr, exit code, signal, timed-out flag). Audited as
   * `command.run`. Never throws for a non-zero exit — the exit code is returned
   * so callers can decide; it throws only for spawn failures / missing command.
   */
  async runCommand(
    actor: TerminalActor,
    correlationId: UUID | null,
    options: TerminalRunOptions,
  ): Promise<TerminalCommandResult> {
    this.assertCommand(options);
    const processId = this.genProcessId();
    const record = this.begin('command.run', actor, correlationId, options, processId);
    const callbacks = this.callbacksFor(actor, correlationId, record.commandLine, processId);
    this.publishStarted(actor, correlationId, record.commandLine, processId);
    try {
      const result = await this.manager.run(processId, options, callbacks);
      const ok = result.exitCode === 0 && !result.timedOut;
      this.commit(record, ok, ok ? undefined : `exit code ${result.exitCode}`);
      return result;
    } catch (error) {
      const mapped = mapSpawnError(record.commandLine, error);
      this.commit(record, false, mapped.message);
      void this.bus.publish(TerminalCommandFailed, {
        processId,
        commandLine: record.commandLine,
        reason: mapped.message,
        actor,
        correlationId: this.cid(correlationId),
        timestamp: Date.now(),
      });
      throw mapped;
    }
  }

  // --- background start ------------------------------------------------------

  /**
   * Start a command in the background. Resolves immediately with the process
   * metadata (id + pid). Output streams via `terminal.output` events and the
   * process is finalized by a `terminal.command-completed` event. Audited as
   * `command.start`.
   */
  startProcess(
    actor: TerminalActor,
    correlationId: UUID | null,
    options: TerminalRunOptions,
  ): TerminalProcessInfo {
    this.assertCommand(options);
    const processId = this.genProcessId();
    const record = this.begin(
      'command.start',
      actor,
      correlationId,
      { ...options, background: true },
      processId,
    );
    const callbacks = this.callbacksFor(actor, correlationId, record.commandLine, processId);
    this.publishStarted(actor, correlationId, record.commandLine, processId);
    try {
      const info = this.manager.start(processId, { ...options, background: true }, callbacks);
      this.commit(record, true);
      return info;
    } catch (error) {
      const mapped = mapSpawnError(record.commandLine, error);
      this.commit(record, false, mapped.message);
      void this.bus.publish(TerminalCommandFailed, {
        processId,
        commandLine: record.commandLine,
        reason: mapped.message,
        actor,
        correlationId: this.cid(correlationId),
        timestamp: Date.now(),
      });
      throw mapped;
    }
  }

  // --- stop / inspect --------------------------------------------------------

  /** Stop a running process by id. Audited as `command.stop`. */
  stopProcess(
    actor: TerminalActor,
    correlationId: UUID | null,
    processId: TerminalProcessId,
    signal = 'SIGTERM',
  ): TerminalProcessInfo {
    const record = this.begin('command.stop', actor, correlationId, undefined, processId);
    try {
      const info = this.manager.stop(processId, signal);
      this.commit(record, true);
      void this.bus.publish(TerminalProcessStopped, {
        processId,
        pid: info.pid,
        signal,
        actor,
        correlationId: this.cid(correlationId),
        timestamp: Date.now(),
      });
      return info;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.commit(record, false, reason);
      throw error;
    }
  }

  /** Snapshot of a single process by id. Throws if unknown. */
  getProcess(processId: TerminalProcessId): TerminalProcessInfo {
    return this.manager.get(processId);
  }

  /** All known processes (running and recently finished). */
  listProcesses(): ReadonlyArray<TerminalProcessInfo> {
    return this.manager.list();
  }

  /** Captured stdout/stderr for a process id. Throws if unknown. */
  getProcessOutput(processId: TerminalProcessId): {
    readonly stdout: string;
    readonly stderr: string;
  } {
    return this.manager.output(processId);
  }

  // --- audit -----------------------------------------------------------------

  /** The full, immutable audit trail in emission order (oldest → newest). */
  auditTrail(): ReadonlyArray<TerminalAuditRecord> {
    return this.audit;
  }

  /** The `limit` most recent audit records (oldest → newest). */
  recentAudit(limit = 50): ReadonlyArray<TerminalAuditRecord> {
    return this.audit.slice(-limit);
  }

  /** Resolve the mission id for a correlation id, if the Coordinator link is wired. */
  resolveMission(correlationId: UUID): { missionId: string } | null {
    return this.coordinator?.resolveMission(correlationId) ?? null;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.manager.dispose();
  }

  // --- internals -------------------------------------------------------------

  private publishStarted(
    actor: TerminalActor,
    correlationId: UUID | null,
    commandLine: string,
    processId: TerminalProcessId,
  ): void {
    void this.bus.publish(TerminalCommandStarted, {
      processId,
      pid: null,
      commandLine,
      kind: undefined,
      actor,
      correlationId: this.cid(correlationId),
      timestamp: Date.now(),
    });
  }

  private callbacksFor(
    actor: TerminalActor,
    correlationId: UUID | null,
    commandLine: string,
    processId: TerminalProcessId,
  ): ProcessHandleCallbacks {
    return {
      onData: (stream, chunk) => {
        void this.bus.publish(TerminalOutput, {
          processId,
          stream,
          chunk,
          actor,
          correlationId: this.cid(correlationId),
          timestamp: Date.now(),
        });
      },
      onExit: (outcome) => {
        // The completion event is derived from the manager's final buffer; the
        // client republishes a normalized, tail-trimmed completion record.
        const out = this.manager.output(processId);
        const info = this.manager.get(processId);
        void this.bus.publish(TerminalCommandCompleted, {
          processId,
          pid: info.pid,
          commandLine,
          exitCode: outcome.code,
          signal: outcome.signal,
          timedOut: outcome.timedOut,
          stdoutTail: out.stdout.length > 2048 ? out.stdout.slice(-2048) : out.stdout,
          stderrTail: out.stderr.length > 2048 ? out.stderr.slice(-2048) : out.stderr,
          actor,
          correlationId: this.cid(correlationId),
          timestamp: Date.now(),
        });
      },
      onError: () => {
        // Spawn failures are surfaced via runCommand/startProcess's catch block.
      },
    };
  }

  private assertCommand(options: TerminalRunOptions): void {
    if (options.command.trim().length === 0) {
      throw new TerminalCommandRequiredError();
    }
  }

  private begin(
    operation: TerminalAuditOperation,
    actor: TerminalActor,
    correlationId: UUID | null,
    options: TerminalRunOptions | undefined,
    processId: TerminalProcessId,
  ): { id: TerminalProcessId; commandLine: string } & Omit<
    TerminalAuditRecord,
    'ok' | 'error' | 'timestamp'
  > {
    const seq = this.seq;
    this.seq += 1;
    const commandLine = options === undefined ? processId : formatForAudit(options);
    const record = {
      seq,
      kind: operation,
      operation,
      commandLine,
      actor,
      correlationId,
      id: processId,
    } as { id: TerminalProcessId; commandLine: string } & Omit<
      TerminalAuditRecord,
      'ok' | 'error' | 'timestamp'
    >;
    return record;
  }

  private commit(
    partial: { id: TerminalProcessId; commandLine: string } & Omit<
      TerminalAuditRecord,
      'ok' | 'error' | 'timestamp'
    >,
    ok: boolean,
    error?: string,
  ): void {
    const entry: TerminalAuditRecord = {
      ...partial,
      ok,
      ...(error !== undefined ? { error } : {}),
      timestamp: Date.now() as Timestamp,
    };
    this.audit.push(entry);
  }

  private genProcessId(): TerminalProcessId {
    return this.cidGenerator() as TerminalProcessId;
  }

  private cid(correlationId: UUID | null): string | null {
    return correlationId;
  }
}

function formatForAudit(options: TerminalRunOptions): string {
  const args = options.args ?? [];
  const cmd = [options.command, ...args].join(' ');
  return cmd;
}

// Avoid an unused-import lint while keeping the error type available to callers.
export type { TerminalError };
