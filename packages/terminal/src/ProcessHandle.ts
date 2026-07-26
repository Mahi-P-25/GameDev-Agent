import type { Logger } from '@gamedev-agent/logging';
import type { Disposable, Timestamp } from '@gamedev-agent/shared';
import type {
  SpawnedProcess,
  TerminalCommandResult,
  TerminalProcessId,
  TerminalProcessInfo,
  TerminalProcessKind,
} from './TerminalTypes';
import { asTerminalProcessId } from './TerminalTypes';

/** Callbacks the {@link ProcessHandle} invokes as the process produces output / exits. */
export interface ProcessHandleCallbacks {
  /** A decoded chunk arrived on the given stream. */
  onData(stream: 'stdout' | 'stderr', chunk: string): void;
  /** The process exited (code/signal), possibly due to a timeout. */
  onExit(outcome: ProcessOutcome): void;
  /** The process failed to spawn (before any exit). */
  onError(error: Error): void;
}

/** The resolved terminal state of a finished process. */
export interface ProcessOutcome {
  readonly code: number | null;
  readonly signal: string | null;
  readonly timedOut: boolean;
}

/** Hard cap on retained stdout/stderr per process (bytes). Beyond this we keep only the tail. */
const MAX_BUFFER_BYTES = 4 * 1024 * 1024;
/** Number of trailing characters echoed in completion events. */
const TAIL_CHARS = 2048;
/** Default signal used to request a graceful stop. */
const DEFAULT_TERM_SIGNAL = 'SIGTERM';
const DEFAULT_KILL_SIGNAL = 'SIGKILL';

/**
 * A live, backend-agnostic handle over a single spawned process.
 *
 * It owns all per-process runtime state the Terminal Tool needs: the decoded
 * stdout/stderr buffers (capped so a chatty process cannot exhaust memory), the
 * exit outcome, the timeout enforcement, and the two-stage kill (SIGTERM →
 * SIGKILL after a grace period) used both for timeouts and explicit stops.
 *
 * The handle is the *only* place that talks to the {@link SpawnedProcess}. The
 * {@link CommandRunner} creates one per execution; the {@link ProcessManager}
 * registers it and the {@link TerminalClient} publishes events from its
 * callbacks. The handle never imports the Event Bus — it is pure process state.
 */
export class ProcessHandle implements Disposable {
  private stdoutBuf = '';
  private stderrBuf = '';
  private timedOut = false;
  private running = true;
  private exitCode: number | null = null;
  private signal: string | null = null;
  private finishedAt: Timestamp | null = null;

  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private killTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  private resolveOutcome!: (outcome: ProcessOutcome) => void;
  private rejectOutcome!: (error: Error) => void;
  private readonly outcome: Promise<ProcessOutcome>;

  constructor(
    private readonly spawned: SpawnedProcess,
    private readonly kind: TerminalProcessKind,
    private readonly commandLine: string,
    private readonly args: ReadonlyArray<string>,
    private readonly cwd: string | null,
    private readonly timeoutMs: number,
    private readonly killGraceMs: number,
    private readonly logger: Logger,
    private readonly callbacks: ProcessHandleCallbacks,
    readonly id: TerminalProcessId = asTerminalProcessId(
      `proc_${Math.random().toString(36).slice(2)}`,
    ),
  ) {
    this.outcome = new Promise<ProcessOutcome>((resolve, reject) => {
      this.resolveOutcome = resolve;
      this.rejectOutcome = reject;
    });
    this.wire();
    if (this.timeoutMs > 0) {
      this.timeoutTimer = setTimeout(() => this.onTimeout(), this.timeoutMs);
    }
  }

  /** OS process id, when known. */
  get pid(): number | null {
    return this.spawned.pid;
  }

  /** Whether the process is still running. */
  get isRunning(): boolean {
    return this.running;
  }

  /** Snapshot of process metadata + current live state. */
  info(): TerminalProcessInfo {
    return {
      id: this.id,
      pid: this.spawned.pid,
      command: this.commandLine,
      args: this.args,
      cwd: this.cwd,
      kind: this.kind,
      running: this.running,
      exitCode: this.exitCode,
      signal: this.signal,
      timedOut: this.timedOut,
      startedAt: Date.now() as Timestamp,
      finishedAt: this.finishedAt,
    };
  }

  /** The captured stdout/stderr so far (capped). */
  output(): { readonly stdout: string; readonly stderr: string } {
    return { stdout: this.stdoutBuf, stderr: this.stderrBuf };
  }

  /** Trailing portion of a stream, for event payloads. */
  tail(stream: 'stdout' | 'stderr', max = TAIL_CHARS): string {
    const buf = stream === 'stdout' ? this.stdoutBuf : this.stderrBuf;
    return buf.length <= max ? buf : buf.slice(buf.length - max);
  }

  /**
   * Request the process stop. Sends `SIGTERM` (or the supplied signal) and,
   * after the grace period, escalates to `SIGKILL` if still alive. Returns
   * whether the initial signal was delivered to the backend.
   */
  kill(signal: string = DEFAULT_TERM_SIGNAL): boolean {
    if (!this.running) {
      return false;
    }
    const delivered = this.spawned.kill(signal);
    this.scheduleKill();
    return delivered;
  }

  /** Resolve once the process has exited (or failed to spawn). */
  wait(): Promise<TerminalCommandResult> {
    return this.outcome.then((outcome) => ({
      stdout: this.stdoutBuf,
      stderr: this.stderrBuf,
      exitCode: outcome.code,
      signal: outcome.signal,
      timedOut: outcome.timedOut,
      pid: this.spawned.pid,
      ...(this.kind === 'background' ? { processId: this.id } : {}),
    }));
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.clearTimers();
    if (this.running) {
      this.spawned.kill(DEFAULT_KILL_SIGNAL);
    }
    this.spawned.dispose();
  }

  // --- internals -------------------------------------------------------------

  private wire(): void {
    this.spawned.onData('stdout', (chunk) => this.append('stdout', chunk));
    this.spawned.onData('stderr', (chunk) => this.append('stderr', chunk));
    this.spawned.onError((error) => {
      if (!this.running) {
        return;
      }
      this.running = false;
      this.clearTimers();
      this.callbacks.onError(error);
      this.rejectOutcome(error);
    });
    this.spawned.onExit((exit) => {
      this.finish({ code: exit.code, signal: exit.signal, timedOut: this.timedOut });
    });
  }

  private append(stream: 'stdout' | 'stderr', chunk: Uint8Array | string): void {
    const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
    if (text.length === 0) {
      return;
    }
    if (stream === 'stdout') {
      this.stdoutBuf = this.capped(this.stdoutBuf, text);
    } else {
      this.stderrBuf = this.capped(this.stderrBuf, text);
    }
    this.callbacks.onData(stream, text);
  }

  private capped(current: string, addition: string): string {
    const next = current + addition;
    if (Buffer.byteLength(next, 'utf-8') <= MAX_BUFFER_BYTES) {
      return next;
    }
    // Keep the most recent MAX_BUFFER_BYTES; shift off the oldest.
    const trimmed = next.slice(next.length - MAX_BUFFER_BYTES);
    return trimmed.length === next.length ? next : trimmed;
  }

  private finish(outcome: ProcessOutcome): void {
    if (!this.running) {
      return;
    }
    this.running = false;
    this.exitCode = outcome.code;
    this.signal = outcome.signal;
    this.finishedAt = Date.now() as Timestamp;
    this.clearTimers();
    this.resolveOutcome(outcome);
    this.callbacks.onExit(outcome);
  }

  private onTimeout(): void {
    if (!this.running) {
      return;
    }
    this.timedOut = true;
    this.logger.warn('terminal.process-timeout', {
      processId: this.id,
      commandLine: this.commandLine,
    });
    this.kill(DEFAULT_TERM_SIGNAL);
  }

  private scheduleKill(): void {
    if (this.killTimer !== null || !this.running) {
      return;
    }
    this.killTimer = setTimeout(() => {
      if (this.running) {
        this.spawned.kill(DEFAULT_KILL_SIGNAL);
      }
    }, this.killGraceMs);
  }

  private clearTimers(): void {
    if (this.timeoutTimer !== null) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    if (this.killTimer !== null) {
      clearTimeout(this.killTimer);
      this.killTimer = null;
    }
  }
}
