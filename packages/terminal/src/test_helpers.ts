import type { Envelope, EventBusContract, EventDefinition } from '@gamedev-agent/events';
import type { Json } from '@gamedev-agent/shared';
import type { SpawnedProcess, TerminalProcessRunner, TerminalSpawnOptions } from './TerminalTypes';

/** An in-memory {@link EventBusContract} double for tests. */
export class TestBus implements EventBusContract {
  readonly published: Array<{ type: string; payload: unknown }> = [];

  async publish<T>(definition: EventDefinition<T>, payload: T): Promise<void> {
    this.published.push({ type: definition.type, payload });
  }

  subscribe(): { dispose(): void } {
    return { dispose() {} };
  }
  once(): { dispose(): void } {
    return { dispose() {} };
  }
  unsubscribe(): void {}
  replay(): Array<Envelope<unknown>> {
    return this.published.map(
      (p) =>
        ({
          definition: { type: p.type, version: 1 } as EventDefinition<unknown>,
          metadata: { timestamp: 0, source: 'test' } as never,
          payload: p.payload,
        }) as Envelope<unknown>,
    );
  }
  history(): ReadonlyArray<Envelope<unknown>> {
    return this.replay();
  }
  clearHistory(): void {
    this.published.length = 0;
  }
  use(): void {}
  metrics(): {
    published: number;
    delivered: number;
    dropped: number;
    historySize: number;
    subscriberCount: number;
    failedHandlers: number;
    lastPublishMicros: number;
  } {
    return {
      published: this.published.length,
      delivered: this.published.length,
      dropped: 0,
      historySize: this.published.length,
      subscriberCount: 0,
      failedHandlers: 0,
      lastPublishMicros: 0,
    };
  }
  dispose(): void {}

  ofType(type: string): Array<{ type: string; payload: unknown }> {
    return this.published.filter((e) => e.type === type);
  }
}

let counter = 0;

/** Deterministic process-id generator for tests. */
export function deterministicId(): string {
  counter += 1;
  return `proc_test_${counter}`;
}

/** A controllable fake process the {@link FakeProcessRunner} spawns. */
export class FakeProcess implements SpawnedProcess {
  pid: number | null = 1000 + counter;
  private dataHandlers: Array<(s: 'stdout' | 'stderr', c: Uint8Array | string) => void> = [];
  private exitHandler?: (e: { code: number | null; signal: string | null }) => void;
  private errorHandler?: (e: Error) => void;
  private exited = false;

  constructor(
    _command: string,
    private readonly stdoutLines: ReadonlyArray<string> = [],
    private readonly stderrLines: ReadonlyArray<string> = [],
    private readonly exitCode: number | null = 0,
    private readonly autoExit = true,
  ) {}

  onData(stream: 'stdout' | 'stderr', handler: (chunk: Uint8Array | string) => void): void {
    this.dataHandlers.push((s, c) => {
      if (s === stream) handler(c);
    });
  }
  onExit(handler: (exit: { code: number | null; signal: string | null }) => void): void {
    this.exitHandler = handler;
  }
  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }
  kill(): boolean {
    if (this.exited) return false;
    this.exited = true;
    this.exitHandler?.({ code: null, signal: 'SIGTERM' });
    return true;
  }
  async wait(): Promise<{ code: number | null; signal: string | null }> {
    return new Promise((resolve) => {
      this.exitHandler = (e) => resolve(e);
    });
  }
  dispose(): void {}

  /** Drive the fake: emit prepared output, then exit with the configured code. */
  run(): void {
    for (const line of this.stdoutLines) {
      for (const h of this.dataHandlers) h('stdout', line);
    }
    for (const line of this.stderrLines) {
      for (const h of this.dataHandlers) h('stderr', line);
    }
    if (this.autoExit) {
      this.exited = true;
      this.exitHandler?.({ code: this.exitCode, signal: null });
    }
  }

  /** Simulate a spawn failure (e.g. command not found). */
  fail(error: Error): void {
    this.errorHandler?.(error);
  }
}

/** A {@link TerminalProcessRunner} that returns scripted {@link FakeProcess} instances. */
export class FakeProcessRunner implements TerminalProcessRunner {
  private planned: Array<() => FakeProcess> = [];
  private spawnedProcesses: Array<FakeProcess> = [];

  /** Queue the next process the runner should produce. */
  enqueue(make: () => FakeProcess): void {
    this.planned.push(make);
  }

  spawn(
    _command: string,
    _args: ReadonlyArray<string>,
    _options: TerminalSpawnOptions,
  ): SpawnedProcess {
    const make = this.planned.shift();
    if (make === undefined) {
      throw new Error('FakeProcessRunner: no planned process');
    }
    const proc = make();
    this.spawnedProcesses.push(proc);
    // Defer execution so listeners are attached before output flows.
    queueMicrotask(() => proc.run());
    return proc;
  }

  /** All fake processes produced so far (for assertions). */
  all(): ReadonlyArray<FakeProcess> {
    return this.spawnedProcesses;
  }
}

/** Helper to build a Json-compatible options object. */
export function json(value: unknown): Json {
  return value as Json;
}
