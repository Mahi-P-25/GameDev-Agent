import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ExecOptions, ExecResult, ProcessExecutor } from './executor';

const execFileAsync = promisify(execFile);

/**
 * The real {@link ProcessExecutor} — uses `node:child_process` to run commands
 * and capture their true stdout/stderr/exit code.
 *
 * IMPORTANT: this module imports `node:child_process`. It must ONLY be imported
 * by the Node runtime module (`RuntimeNodeModule`), never by the browser module
 * or anything the Studio web bundle can reach. That keeps `node:*` out of the
 * browser bundle while still giving the backend genuine process observation.
 */
export class NodeProcessExecutor implements ProcessExecutor {
  async exec(
    command: string,
    args: ReadonlyArray<string>,
    options: ExecOptions,
  ): Promise<ExecResult> {
    const timeout = options.timeoutMs ?? 30_000;
    try {
      const output = await execFileAsync(command, [...args], {
        cwd: options.cwd,
        env: { ...process.env, ...(options.env ?? {}) },
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      });
      return {
        exitCode: 0,
        stdout: output.stdout,
        stderr: output.stderr,
      };
    } catch (error: unknown) {
      const e = error as {
        stdout?: string;
        stderr?: string;
        code?: number | null;
        killed?: boolean;
      };
      // `execFile` rejects with code/message on non-zero exit; treat that as a
      // real result (non-zero exit code) rather than an exception so callers can
      // truthfully report failure.
      if (e.killed === true) {
        return {
          exitCode: 124,
          stdout: e.stdout ?? '',
          stderr: e.stderr ?? 'timed out',
        };
      }
      return {
        exitCode: typeof e.code === 'number' ? e.code : 1,
        stdout: e.stdout ?? '',
        stderr: e.stderr ?? (error instanceof Error ? error.message : String(error)),
      };
    }
  }
}
