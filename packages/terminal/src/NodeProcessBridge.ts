import type { ChildProcess } from 'node:child_process';
import type { SpawnedProcess } from './TerminalTypes';

/**
 * Adapts a `node:child_process.ChildProcess` to the backend-agnostic
 * {@link SpawnedProcess} interface the {@link CommandRunner} depends on.
 *
 * Keeping this adapter in one small file means the rest of the package never
 * imports Node's process types directly — tests can supply a fake
 * {@link SpawnedProcess} and the production path uses this bridge over the real
 * `spawn`. All raw Node errors are surfaced through `onError` so the client can
 * translate them at its boundary.
 */
export class NodeProcessBridge implements SpawnedProcess {
  constructor(private readonly child: ChildProcess) {
    this.child.on('error', (error: Error) => {
      this.errorHandler?.(error);
    });
    this.child.on('exit', (code: number | null, signal: string | null) => {
      this.exitHandler?.({ code, signal });
    });
    this.child.stdout?.on('data', (chunk: Uint8Array | string) => {
      this.dataHandler?.('stdout', chunk);
    });
    this.child.stderr?.on('data', (chunk: Uint8Array | string) => {
      this.dataHandler?.('stderr', chunk);
    });
  }

  get pid(): number | null {
    return this.child.pid ?? null;
  }

  onData(stream: 'stdout' | 'stderr', handler: (chunk: Uint8Array | string) => void): void {
    this.dataHandler = (s, chunk) => {
      if (s === stream) {
        handler(chunk);
      }
    };
  }

  onExit(handler: (exit: { code: number | null; signal: string | null }) => void): void {
    this.exitHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  kill(signal?: string): boolean {
    return this.child.kill(signal as NodeJS.Signals | undefined);
  }

  async wait(): Promise<{ code: number | null; signal: string | null }> {
    return new Promise((resolve) => {
      this.child.on('exit', (code: number | null, signal: string | null) => {
        resolve({ code, signal });
      });
      this.child.on('error', () => {
        // A spawn error means the process never started; resolve so the caller
        // can surface it via onError without hanging on wait().
        resolve({ code: null, signal: null });
      });
    });
  }

  dispose(): void {
    if (this.child.stdout) {
      this.child.stdout.removeAllListeners();
    }
    if (this.child.stderr) {
      this.child.stderr.removeAllListeners();
    }
    this.child.removeAllListeners();
  }

  private dataHandler?: (stream: 'stdout' | 'stderr', chunk: Uint8Array | string) => void;
  private exitHandler?: (exit: { code: number | null; signal: string | null }) => void;
  private errorHandler?: (error: Error) => void;
}
