import type { Timestamp } from '@gamedev-agent/shared';
import type {
  Clock,
  Envelope,
  EventBusContract,
  EventHandler,
  IdGenerator,
} from '@gamedev-agent/events';

export class FixedClock implements Clock {
  constructor(private nowValue = 1_700_000_000_000) {}
  now(): number {
    return this.nowValue as Timestamp;
  }
}

export class SequenceIdGenerator implements IdGenerator {
  private counter = 0;
  generate(): string {
    this.counter += 1;
    const seq = String(this.counter).padStart(12, '0');
    return `00000000-0000-0000-0000-${seq}`;
  }
}

interface Recorded {
  readonly type: string;
  readonly payload: unknown;
}

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

  subscribe<T>(definition: { readonly type: string }, handler: EventHandler<T>): { dispose(): void } {
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

  emitted<T>(type: string): Array<T> {
    return this.recorded.filter((r) => r.type === type).map((r) => r.payload as T);
  }

  get publishCount(): number {
    return this.recorded.length;
  }
}
