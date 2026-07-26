import type { Envelope, EventBusContract, EventHandler } from '@gamedev-agent/events';
import type { Clock, IdGenerator } from '@gamedev-agent/events';
import type { ProjectId } from '@gamedev-agent/project';
import type { GoalRequest } from './ProducerTypes';

/** A fixed clock for deterministic timestamps in tests. */
export class FixedClock implements Clock {
  constructor(private nowValue = 1_700_000_000_000) {}
  now(): number {
    return this.nowValue;
  }
  set(value: number): void {
    this.nowValue = value;
  }
}

/** A deterministic id generator producing `id-1`, `id-2`, ... in call order. */
export class SequenceIdGenerator implements IdGenerator {
  private counter = 0;
  generate(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }
}

interface Recorded {
  readonly type: string;
  readonly payload: unknown;
}

/**
 * An in-memory EventBus double implementing only the surface the Producer uses
 * ({@link publish}/{@link subscribe}). Records every published envelope so
 * assertions can inspect emitted events precisely, keeping tests framework-free
 * and fast — the same double the Coordinator uses.
 */
export class FakeEventBus implements EventBusContract {
  private readonly handlers = new Map<string, Array<EventHandler<unknown>>>();
  private readonly recorded: Array<Recorded> = [];

  async publish<T>(definition: { readonly type: string }, payload: T): Promise<void> {
    this.recorded.push({ type: definition.type, payload });
    const list = this.handlers.get(definition.type);
    if (list !== undefined) {
      for (const handler of list) {
        await handler({
          definition: definition as never,
          metadata: {} as Envelope<T>['metadata'],
          payload,
        });
      }
    }
  }

  subscribe<T>(
    definition: { readonly type: string },
    handler: EventHandler<T>,
  ): { dispose(): void } {
    const list = this.handlers.get(definition.type) ?? [];
    list.push(handler as EventHandler<unknown>);
    this.handlers.set(definition.type, list);
    return { dispose: () => {} };
  }

  once(): { dispose(): void } {
    return { dispose: () => {} };
  }

  unsubscribe(): void {}

  replay(): Array<Envelope<unknown>> {
    return [];
  }

  history(): ReadonlyArray<Envelope<unknown>> {
    return [];
  }

  clearHistory(): void {}

  use(): void {}

  metrics() {
    return {
      published: this.recorded.length,
      delivered: 0,
      dropped: 0,
      historySize: 0,
      subscriberCount: 0,
      failedHandlers: 0,
      lastPublishMicros: 0,
    };
  }

  dispose(): void {
    this.handlers.clear();
  }

  /** Test helper: all payloads emitted for a given event type, in order. */
  emitted<T>(type: string): Array<T> {
    return this.recorded.filter((r) => r.type === type).map((r) => r.payload as T);
  }

  /** Test helper: ordered list of every emitted event type. */
  get types(): ReadonlyArray<string> {
    return this.recorded.map((r) => r.type);
  }

  /** Test helper: count of all published events. */
  get publishCount(): number {
    return this.recorded.length;
  }
}

/** Build a valid {@link GoalRequest} with sensible defaults for tests. */
export function makeGoalRequest(overrides: Partial<GoalRequest> = {}): GoalRequest {
  return {
    projectId: 'project-1' as ProjectId,
    title: 'Realistic Formula racing',
    description: 'I want realistic Formula racing with physics, AI opponents, and audio.',
    priority: 'high',
    ...overrides,
  };
}
