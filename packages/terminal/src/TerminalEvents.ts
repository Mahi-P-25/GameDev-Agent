import type { EventDefinition } from '@gamedev-agent/events';
import type { TerminalActor, TerminalProcessId, TerminalProcessKind } from './TerminalTypes';

/**
 * Strongly-typed event catalog for the Nova Terminal Tool.
 *
 * Following the Nova convention `<aggregate>.<pastTenseVerb>` (e.g.
 * `terminal.command-started`), every meaningful state change emits a typed
 * {@link EventDefinition} (stable `type` + `version: 1`). Subscribers bind to
 * the definition, not a magic string, so payloads are fully inferred and the
 * compiler catches drift. The tool publishes these through the shared Event Bus
 * — it never calls other packages directly. This is how the Studio API,
 * Coordinator, and UI observe terminal activity without the tool depending on
 * them.
 */

/** Emitted the moment a command begins executing. */
export interface TerminalCommandStartedPayload {
  readonly processId: TerminalProcessId;
  readonly pid: number | null | undefined;
  readonly commandLine: string;
  readonly kind: TerminalProcessKind | undefined;
  readonly actor: TerminalActor;
  readonly correlationId: string | null;
  readonly timestamp: number;
}

/** Emitted for every captured stdout/stderr chunk (the streaming surface). */
export interface TerminalOutputPayload {
  readonly processId: TerminalProcessId;
  /** `stdout` or `stderr`. */
  readonly stream: 'stdout' | 'stderr';
  /** The decoded chunk. */
  readonly chunk: string;
  readonly actor: TerminalActor;
  readonly correlationId: string | null;
  readonly timestamp: number;
}

/** Emitted when a foreground command finishes (or a background process ends). */
export interface TerminalCommandCompletedPayload {
  readonly processId: TerminalProcessId;
  readonly pid: number | null;
  readonly commandLine: string;
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly timedOut: boolean;
  /** Truncated stdout/stderr tails for the activity feed (full data via output buffer). */
  readonly stdoutTail: string;
  readonly stderrTail: string;
  readonly actor: TerminalActor;
  readonly correlationId: string | null;
  readonly timestamp: number;
}

/** Emitted when a command fails to spawn or is rejected before running. */
export interface TerminalCommandFailedPayload {
  readonly processId: TerminalProcessId | null;
  readonly commandLine: string;
  readonly reason: string;
  readonly actor: TerminalActor;
  readonly correlationId: string | null;
  readonly timestamp: number;
}

/** Emitted when a process is explicitly stopped (cancel). */
export interface TerminalProcessStoppedPayload {
  readonly processId: TerminalProcessId;
  readonly pid: number | null;
  readonly signal: string | null;
  readonly actor: TerminalActor;
  readonly correlationId: string | null;
  readonly timestamp: number;
}

export const TerminalCommandStarted = define<TerminalCommandStartedPayload>(
  'terminal.command-started',
);
export const TerminalOutput = define<TerminalOutputPayload>('terminal.output');
export const TerminalCommandCompleted = define<TerminalCommandCompletedPayload>(
  'terminal.command-completed',
);
export const TerminalCommandFailed =
  define<TerminalCommandFailedPayload>('terminal.command-failed');
export const TerminalProcessStopped = define<TerminalProcessStoppedPayload>(
  'terminal.process-stopped',
);

/** All Terminal Tool event payloads, for consumers that need a union. */
export type TerminalEventPayloads =
  | TerminalCommandStartedPayload
  | TerminalOutputPayload
  | TerminalCommandCompletedPayload
  | TerminalCommandFailedPayload
  | TerminalProcessStoppedPayload;

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

/** Re-exported for the Studio API / Coordinator link that maps these to missions. */
export type { TerminalActor, TerminalProcessId, TerminalProcessKind };
