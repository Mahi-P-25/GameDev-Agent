import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Envelope, EventBusContract } from '@gamedev-agent/events';
import type { VSCodeWorkspaceId } from '@gamedev-agent/vscode';

/** A minimal in-memory Event Bus double for tests. */
export class TestBus implements EventBusContract {
  readonly published: Array<Envelope<unknown>> = [];

  async publish<T>(definition: { type: string; version: number }, payload: T): Promise<void> {
    this.published.push({
      definition: definition as never,
      metadata: {
        eventId: 'test' as never,
        timestamp: Date.now() as never,
        source: 'test',
        correlationId: null,
        priority: 'normal',
        version: definition.version,
      },
      payload: payload as never,
    });
  }

  subscribe(): { dispose(): void } {
    return { dispose() {} };
  }
  once(): { dispose(): void } {
    return { dispose() {} };
  }
  unsubscribe(): void {}
  replay(): Array<Envelope<unknown>> {
    return this.published;
  }
  history(): ReadonlyArray<Envelope<unknown>> {
    return this.published;
  }
  clearHistory(): void {
    this.published.length = 0;
  }
  use(): void {}
  metrics() {
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

  /** All published events of a given type. */
  ofType(type: string): Array<Envelope<unknown>> {
    return this.published.filter((e) => e.definition.type === type);
  }
}

/** Create a throwaway temp directory for a test, returning its path and a cleanup. */
export async function withTempDir(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), 'nova-vscode-'));
  return {
    dir,
    async cleanup() {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

/** Seed a file inside `root`. */
export async function seedFile(root: string, relative: string, content: string): Promise<string> {
  const abs = join(root, relative);
  await writeFile(abs, content, 'utf-8');
  return abs;
}

let counter = 0;
/** Deterministic id generator for WorkspaceService. */
export function deterministicId(): string {
  counter += 1;
  return `ws_${counter}` as VSCodeWorkspaceId;
}
