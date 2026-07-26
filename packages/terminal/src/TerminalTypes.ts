import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import type { Disposable, Timestamp, UUID } from '@gamedev-agent/shared';

/**
 * Domain model and contracts for the Nova Terminal Tool.
 *
 * The Terminal Tool is the **second Tool Runtime integration** (after VS Code).
 * It is built exactly the way the reference plugin is built: it owns a narrow,
 * audited surface over an external environment (a local shell / process
 * spawner), talks to Nova only through the Tool Runtime, Event Bus, Coordinator,
 * Capabilities, and Studio API, and never performs work on its own initiative.
 *
 * Safety is the whole point: **no command executes automatically.** Every
 * execution is an explicit request that names an actor and a correlation id,
 * captures stdout/stderr/exit code, and is written to an immutable audit trail.
 *
 * This module defines the public, stable shapes. It contains no logic — only
 * types and the {@link CoordinatorLink} seam. The {@link TerminalToolHandler}
 * contract a concrete process backend fulfills is defined here too so the
 * {@link CommandRunner} stays backend-agnostic and unit-testable with doubles.
 */

/** Branded Terminal process identifier. Plain string at runtime, distinct at the type level. */
export type TerminalProcessId = string & { readonly __brand: 'TerminalProcessId' };

/** Coerce a string into a {@link TerminalProcessId}. Purely a type-level assertion. */
export function asTerminalProcessId(value: string): TerminalProcessId {
  return value as TerminalProcessId;
}

/** The kind of process lifecycle a command uses. */
export type TerminalProcessKind = 'foreground' | 'background';

/** The outcome of a foreground command or a finalized background process. */
export interface TerminalCommandResult {
  /** Everything the process wrote to stdout (decoded as UTF-8). */
  readonly stdout: string;
  /** Everything the process wrote to stderr (decoded as UTF-8). */
  readonly stderr: string;
  /** Process exit code, or `null` when it was terminated by a signal. */
  readonly exitCode: number | null;
  /** The signal that terminated the process, if any (e.g. `SIGTERM`). */
  readonly signal: string | null;
  /** Whether the process was killed because it exceeded its timeout. */
  readonly timedOut: boolean;
  /** OS process id, when known. */
  readonly pid: number | null;
  /** Present for background processes: the id used to later stop/inspect it. */
  readonly processId?: TerminalProcessId;
}

/** A live or finished background process, as reported by the client. */
export interface TerminalProcessInfo {
  readonly id: TerminalProcessId;
  readonly pid: number | null;
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  /** Working directory the process was launched in. */
  readonly cwd: string | null;
  readonly kind: TerminalProcessKind;
  /** Whether the process is still running. */
  readonly running: boolean;
  /** Exit code once finished. */
  readonly exitCode: number | null;
  /** Signal that terminated it, once finished. */
  readonly signal: string | null;
  /** Whether it was timed out by the runtime. */
  readonly timedOut: boolean;
  /** Event time the process was started (ms since epoch). */
  readonly startedAt: Timestamp;
  /** Event time the process finished, if it has (ms since epoch). */
  readonly finishedAt: Timestamp | null;
}

/** Options controlling a single command execution (foreground or background). */
export interface TerminalRunOptions {
  /** The program to execute (e.g. `npm`, `git`, `/usr/bin/python`). */
  readonly command: string;
  /** Arguments passed to the program. */
  readonly args?: ReadonlyArray<string>;
  /** Working directory. Defaults to the process cwd / `process.cwd()`. */
  readonly cwd?: string;
  /** Extra environment variables merged over the (scoped) base environment. */
  readonly env?: Readonly<Record<string, string>>;
  /**
   * Hard timeout in milliseconds. When exceeded, the process is killed (default
   * `SIGTERM`, then `SIGKILL` after a grace period). `0` or omitted means no
   * timeout.
   */
  readonly timeoutMs?: number;
  /** Run detached in the background, returning immediately with a process id. */
  readonly background?: boolean;
}

/**
 * One line in the immutable audit trail.
 *
 * Every command the tool runs is explicit and auditable: a single call produces
 * exactly one audit record with a stable discriminator (`kind`), the actor that
 * requested it, and a correlation id so the action can be traced to a Mission.
 */
export interface TerminalAuditRecord {
  /** Monotonic, per-client sequence number. */
  readonly seq: number;
  /** Stable discriminator, e.g. `command.run`, `process.stop`. */
  readonly kind: string;
  /** The operation performed. */
  readonly operation: TerminalAuditOperation;
  /** The command line that ran (for forensic readability). */
  readonly commandLine: string;
  /** The actor on whose behalf the operation ran (user / role / mission). */
  readonly actor: TerminalActor;
  /** Correlation id linking the operation to a Mission / run on the bus. */
  readonly correlationId: UUID | null;
  /** Whether the operation succeeded (spawned and, for foreground, exited 0). */
  readonly ok: boolean;
  /** Present when `ok` is false. */
  readonly error?: string;
  /** Event time (ms since epoch). */
  readonly timestamp: Timestamp;
}

/** The set of operations the tool can perform (used for audit + events). */
export type TerminalAuditOperation =
  | 'command.run'
  | 'command.start'
  | 'command.stop'
  | 'command.output';

/**
 * The actor on whose behalf a command is executed. The tool never acts on its
 * own: every operation names an explicit actor so the audit trail is
 * unambiguous (mirrors the VS Code integration's `VSCodeActor`).
 */
export interface TerminalActor {
  /** Human or system label, e.g. `director`, `role:gameplay-engineer`. */
  readonly kind: string;
  /** Optional stable id (user id, role id, mission id). */
  readonly id?: string;
}

/**
 * The narrow seam the tool uses to participate in the Coordinator's mission
 * stream. Defined locally (as in `vscode`/`tool-runtime`) so the package stays
 * decoupled from the concrete `CoordinatorManager`. It only *reads* — it never
 * calls the Coordinator directly.
 */
export interface CoordinatorLink {
  /** Resolve the mission id for a correlation id, if known. */
  resolveMission(correlationId: UUID): { missionId: string } | null;
}

/**
 * Options for constructing the {@link TerminalClient}. The client depends only
 * on abstractions (`EventBusContract`, `Logger`), an injected process backend,
 * and an optional Coordinator hook — never on concrete subsystems — so it slots
 * into the kernel via DI and is independently testable with doubles.
 */
export interface TerminalClientOptions {
  /** Shared Nova Event Bus. Required; the client emits command events here. */
  readonly eventBus: EventBusContract;
  /** Namespaced logger. A console-backed root logger is the default. */
  readonly logger?: Logger;
  /** The process backend that actually spawns processes. Required. */
  readonly runner: TerminalProcessRunner;
  /** Id generator for process ids; injected so tests are deterministic. */
  readonly idGenerator?: () => string;
  /**
   * Optional Coordinator integration. When supplied, commands are linked to a
   * Mission via `correlationId` so the operation is observable in the
   * Coordinator's event stream.
   */
  readonly coordinator?: CoordinatorLink;
  /**
   * Base environment variables every command inherits. Defaults to an empty
   * object (the runner decides what baseline to apply). Kept explicit so the
   * tool never silently inherits a privileged ambient environment.
   */
  readonly baseEnv?: Readonly<Record<string, string>>;
  /**
   * Grace period (ms) between `SIGTERM` and `SIGKILL` when enforcing a timeout
   * or stop. Defaults to 2000ms.
   */
  readonly killGraceMs?: number;
}

/**
 * The backend contract a concrete process runner fulfills. The {@link
 * CommandRunner} talks to a process *only* through this interface, so the real
 * `node:child_process` spawner and a fake for tests are interchangeable.
 *
 * The runner returns a {@link SpawnedProcess} that the caller drives to
 * completion: attach data/exit listeners, then `wait()` (or `kill()`).
 */
export interface TerminalProcessRunner {
  spawn(
    command: string,
    args: ReadonlyArray<string>,
    options: TerminalSpawnOptions,
  ): SpawnedProcess;
}

/** Options passed to {@link TerminalProcessRunner.spawn}. */
export interface TerminalSpawnOptions {
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
}

/**
 * A live, backend-agnostic child process handle. Mirrors the slice of
 * `node:child_process.ChildProcess` the {@link CommandRunner} actually uses,
 * so a fake process in tests can satisfy it without pulling in Node types.
 */
export interface SpawnedProcess extends Disposable {
  /** OS process id, when known. */
  readonly pid: number | null;
  /** Attach a listener for a stream (`'stdout'` / `'stderr'`) chunk (Buffer or string). */
  onData(stream: 'stdout' | 'stderr', handler: (chunk: Uint8Array | string) => void): void;
  /** Attach a listener fired once the process exits. `code`/`signal` follow Node semantics. */
  onExit(handler: (exit: { code: number | null; signal: string | null }) => void): void;
  /** Attach a listener for spawn-level errors (e.g. command not found). */
  onError(handler: (error: Error) => void): void;
  /** Send a signal to the process. Returns whether the signal was delivered. */
  kill(signal?: string): boolean;
  /** Resolve once the process has exited (or errored). Safe to await multiple times. */
  wait(): Promise<{ code: number | null; signal: string | null }>;
}

/** Re-exported so consumers do not need a second import for the dispose contract. */
export type { Disposable };
