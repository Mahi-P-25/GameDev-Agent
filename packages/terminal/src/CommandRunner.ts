import type { Logger } from '@gamedev-agent/logging';
import { ProcessHandle, type ProcessHandleCallbacks } from './ProcessHandle';
import type {
  SpawnedProcess,
  TerminalProcessId,
  TerminalProcessRunner,
  TerminalRunOptions,
  TerminalSpawnOptions,
} from './TerminalTypes';
import { asTerminalProcessId } from './TerminalTypes';

/** Default grace period between SIGTERM and SIGKILL. */
const DEFAULT_KILL_GRACE_MS = 2000;

/**
 * Turns a {@link TerminalRunOptions} request into a live {@link ProcessHandle}.
 *
 * The runner is the single seam to the OS: it receives a configured
 * {@link SpawnedProcess} from the injected {@link TerminalProcessRunner} (the
 * real `node:child_process` spawner in production, a fake in tests) and wraps it
 * in a handle that owns buffering, timeout, and kill semantics. The runner
 * holds no per-process state and is trivially swappable.
 */
export class CommandRunner {
  constructor(
    private readonly runner: TerminalProcessRunner,
    private readonly logger: Logger,
    private readonly killGraceMs: number = DEFAULT_KILL_GRACE_MS,
  ) {}

  /**
   * Spawn a process for the given options. `processId` is supplied by the caller
   * (so it is deterministic/testable); `callbacks` receive output/exit/error
   * notifications. Returns the live handle — callers `await handle.wait()` for
   * foreground commands or keep the handle for background ones.
   */
  spawn(
    processId: TerminalProcessId,
    options: TerminalRunOptions,
    callbacks: ProcessHandleCallbacks,
    baseEnv: Readonly<Record<string, string>>,
  ): ProcessHandle {
    const args = options.args ?? [];
    const commandLine = formatCommandLine(options.command, args);
    const spawnOptions: TerminalSpawnOptions = {
      ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
      env: { ...baseEnv, ...(options.env ?? {}) },
    };
    const spawned: SpawnedProcess = this.runner.spawn(options.command, args, spawnOptions);

    this.logger.debug('terminal.spawning', { processId, commandLine, cwd: options.cwd ?? null });

    return new ProcessHandle(
      spawned,
      options.background === true ? 'background' : 'foreground',
      commandLine,
      args,
      options.cwd ?? null,
      options.timeoutMs ?? 0,
      this.killGraceMs,
      this.logger,
      callbacks,
      processId,
    );
  }
}

/** Render a command + args as a single, human-readable command line. */
export function formatCommandLine(command: string, args: ReadonlyArray<string>): string {
  const quote = (value: string): string =>
    value.length > 0 && !/\s/.test(value) && !/["'$&|<>;]/.test(value)
      ? value
      : `'${value.replace(/'/g, `'\\''`)}'`;
  return [command, ...args.map(quote)].join(' ');
}

/** Coerce an already-string id into the branded {@link TerminalProcessId}. */
export function toProcessId(value: string): TerminalProcessId {
  return asTerminalProcessId(value);
}
