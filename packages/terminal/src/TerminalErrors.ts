/**
 * Error hierarchy for the Nova Terminal Tool.
 *
 * Every failure this tool produces is a {@link TerminalError}. Specialized
 * subtypes carry enough structure for callers (and the Studio API) to branch on
 * outcome without string-matching. The tool never lets a raw spawn / system
 * error escape its boundary — it is translated into one of these types at the
 * edge (see {@link mapSpawnError}).
 */

/** Root of all Terminal Tool errors. */
export class TerminalError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TerminalError';
  }
}

/** A command was requested but no command string was supplied. */
export class TerminalCommandRequiredError extends TerminalError {
  constructor() {
    super('a non-empty command is required to execute a terminal command');
    this.name = 'TerminalCommandRequiredError';
  }
}

/** The process backend failed to spawn the command (e.g. command not found). */
export class TerminalSpawnError extends TerminalError {
  constructor(
    readonly commandLine: string,
    reason: string,
    options?: { cause?: unknown },
  ) {
    super(`failed to spawn "${commandLine}": ${reason}`, options);
    this.name = 'TerminalSpawnError';
  }
}

/** An operation referenced a process id that is not known to the manager. */
export class TerminalProcessNotFoundError extends TerminalError {
  constructor(readonly processId: string) {
    super(`no terminal process with id "${processId}"`);
    this.name = 'TerminalProcessNotFoundError';
  }
}

/** A foreground command exited with a non-zero status. */
export class TerminalExitCodeError extends TerminalError {
  constructor(
    readonly commandLine: string,
    readonly exitCode: number,
    readonly stderr: string,
  ) {
    super(`command "${commandLine}" exited with code ${exitCode}`);
    this.name = 'TerminalExitCodeError';
  }
}

/** A command was killed because it exceeded its configured timeout. */
export class TerminalTimeoutError extends TerminalError {
  constructor(
    readonly commandLine: string,
    readonly timeoutMs: number,
  ) {
    super(`command "${commandLine}" timed out after ${timeoutMs}ms`);
    this.name = 'TerminalTimeoutError';
  }
}

/**
 * Translate a low-level spawn/system error thrown by the backend into the
 * stable {@link TerminalError} hierarchy. Keeps raw Node errors from leaking
 * across the tool boundary (Studio API, Event Bus, Coordinator).
 */
export function mapSpawnError(commandLine: string, error: unknown): TerminalError {
  if (error instanceof TerminalError) {
    return error;
  }
  const code = (error as { code?: string } | null)?.code;
  const message = error instanceof Error ? error.message : String(error);
  switch (code) {
    case 'ENOENT':
      return new TerminalSpawnError(commandLine, 'command not found', { cause: error });
    case 'EACCES':
    case 'EPERM':
      return new TerminalSpawnError(commandLine, 'permission denied', { cause: error });
    case 'EINVAL':
      return new TerminalSpawnError(commandLine, 'invalid argument', { cause: error });
    default:
      return new TerminalSpawnError(commandLine, message, { cause: error });
  }
}
