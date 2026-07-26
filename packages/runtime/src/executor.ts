import type { Logger } from '@gamedev-agent/logging';

/**
 * Process execution seam.
 * ===========================================================================
 *
 * The Runtime must run real shell commands (git, the build tool, the test
 * runner, the package manager) to observe the truth. That requires Node's
 * `child_process`. To honor the architecture boundary — the Studio browser
 * bundle must never pull `node:child_process` into the UI — the actual spawning
 * lives behind a {@link ProcessExecutor} interface:
 *
 *  - `NodeProcessExecutor`  — the real implementation using `node:child_process`
 *                             (only imported by the Node runtime module).
 *  - `browserExecutor()`   — a refuser that throws on `spawn`, exactly like the
 *                             terminal package's `browserRunner()`. It lets the
 *                             provider classes load in the browser for their pure,
 *                             read-only surfaces (status snapshots, capability
 *                             declarations) without ever executing a process.
 *
 * Providers depend on the interface, never on Node directly, so they stay
 * independently testable (inject a fake executor in unit tests).
 */

/** Result of a completed process. */
export interface ExecResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Options for a single process invocation. */
export interface ExecOptions {
  /** Working directory (absolute). */
  readonly cwd: string;
  /** Extra env (merged over process.env). */
  readonly env?: Readonly<Record<string, string>>;
  /** Kill after this many ms. */
  readonly timeoutMs?: number;
}

/** The execution contract every provider uses. */
export interface ProcessExecutor {
  /** Run `command args` in `cwd`. Resolves with the real exit/stdout/stderr. */
  exec(command: string, args: ReadonlyArray<string>, options: ExecOptions): Promise<ExecResult>;
}

/** Raised when the browser refuser is asked to spawn a process. */
export class BrowserExecutorError extends Error {
  constructor(command: string) {
    super(
      `[nova.runtime] Process execution is unavailable in the browser. \`${command}\` runs only in the Nova Runtime/backend layer.`,
    );
    this.name = 'BrowserExecutorError';
  }
}

/**
 * The browser-safe executor. It refuses to spawn processes so the Studio UI can
 * never trigger `child_process`. Providers still function for pure reads and
 * capability declarations; only real execution is blocked.
 */
export function browserExecutor(): ProcessExecutor {
  return {
    exec(
      _command: string,
      args: ReadonlyArray<string>,
      _options: ExecOptions,
    ): Promise<ExecResult> {
      throw new BrowserExecutorError([_command, ...args].join(' '));
    },
  };
}

/** A logger-shaped null object for environments without one. */
export function nullLogger(): Logger {
  const noop = (): void => {};
  return {
    child: () => nullLogger(),
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
  } as unknown as Logger;
}
