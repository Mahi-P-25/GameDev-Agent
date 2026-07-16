import type { Disposable } from '@gamedev-agent/shared';
import { SystemClock, UuidGenerator } from './clock';
import { EventHistory } from './history';
import { buildMetadata } from './metadata';
import {
  type BusMetrics,
  type Clock,
  type Envelope,
  type EventBusContract,
  type EventBusOptions,
  type EventDefinition,
  type EventHandler,
  type IdGenerator,
  type Middleware,
  type MiddlewareContext,
  PRIORITY_WEIGHT,
  type PublishMetrics,
  type PublishOptions,
  type SubscribeOptions,
} from './types';

interface HandlerEntry {
  readonly handler: EventHandler<unknown>;
  readonly priority: number;
  once: boolean;
}

/**
 * Production-grade, in-process event bus — the single communication backbone
 * between major packages.
 *
 * Design notes (perf + correctness):
 *  - Handlers per type are held in an **insertion-sorted array** (descending
 *    priority), so the hot publish path is a single forward pass — no per-publish
 *    sort, no array shift.
 *  - History is a **bounded ring buffer** (see {@link EventHistory}); retention
 *    never allocates on the write path and evicts FIPO when full.
 *  - Middleware are **composed once** (lazily, and again only when `use()`
 *    adds one). The composed chain ends in the delivery link, which reads the
 *    active context, so adding/removing subscribers is cheap.
 *  - Time and ids come from injected {@link Clock}/{@link IdGenerator}; the bus
 *    never calls `Date.now()`/`crypto` directly.
 */
export class EventBus implements EventBusContract {
  private readonly source: string;
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private readonly historyStore: EventHistory;
  private readonly handlers = new Map<string, Array<HandlerEntry>>();
  private readonly wildcard: Array<HandlerEntry> = [];
  private middlewares: ReadonlyArray<Middleware>;
  private composed: (context: MiddlewareContext) => Promise<void>;

  private activeContext: MiddlewareContext | null = null;

  private published = 0;
  private delivered = 0;
  private dropped = 0;
  private failedHandlers = 0;
  private lastPublishMicros = 0;

  constructor(options: EventBusOptions) {
    this.source = options.source;
    this.clock = options.clock ?? SystemClock;
    this.idGenerator = options.idGenerator ?? UuidGenerator;
    this.historyStore = new EventHistory(options.historySize ?? 1024);
    this.middlewares = options.middlewares ?? [];
    this.composed = this.compose();
  }

  async publish<T>(
    definition: EventDefinition<T>,
    payload: T,
    options?: PublishOptions,
  ): Promise<void> {
    if (definition.validate !== undefined && !definition.validate(payload)) {
      throw new Error(`Event payload failed validation for "${definition.type}"`);
    }

    const startedAt = performance.now();
    const metadata = buildMetadata(
      definition as EventDefinition<unknown>,
      this.source,
      this.clock,
      this.idGenerator,
      options,
    );
    const envelope: Envelope<unknown> = {
      definition: definition as EventDefinition<unknown>,
      metadata,
      payload: payload as unknown,
    };
    const metrics: PublishMetrics = {
      startedAt,
      subscriberCount: this.subscriberCount(),
      dropped: false,
      failedHandlers: 0,
    };
    const context: MiddlewareContext = {
      envelope,
      cancelled: false,
      metrics,
    };

    this.published++;
    this.activeContext = context;

    try {
      await this.composed(context);
    } finally {
      this.lastPublishMicros = (performance.now() - startedAt) * 1000;
      this.failedHandlers = metrics.failedHandlers;
      if (metrics.dropped || context.cancelled) {
        this.dropped++;
      }
      this.activeContext = null;
    }

    if (context.cancelled) {
      return;
    }

    if (this.historyStore.isEnabled) {
      this.historyStore.record(envelope);
    }
    if (metrics.subscriberCount > 0 && !metrics.dropped) {
      this.delivered++;
    }
  }

  subscribe<T>(
    definition: EventDefinition<T>,
    handler: EventHandler<T>,
    options?: SubscribeOptions,
  ): Disposable {
    const entry: HandlerEntry = {
      handler: handler as EventHandler<unknown>,
      priority: PRIORITY_WEIGHT[options?.priority ?? 'normal'],
      once: false,
    };
    this.insert(definition.type, entry);
    return this.disposableFor(definition.type, entry);
  }

  once<T>(definition: EventDefinition<T>, handler: EventHandler<T>): Disposable {
    const entry: HandlerEntry = {
      handler: handler as EventHandler<unknown>,
      priority: PRIORITY_WEIGHT.normal,
      once: true,
    };
    this.insert(definition.type, entry);
    return this.disposableFor(definition.type, entry);
  }

  unsubscribe<T>(definition: EventDefinition<T>, handler: EventHandler<T>): void {
    this.remove(definition.type, handler as EventHandler<unknown>);
  }

  replay<T>(definition?: EventDefinition<T>, since?: number): Array<Envelope<unknown>> {
    const base =
      since !== undefined ? this.historyStore.since(since) : this.historyStore.snapshot();
    if (definition === undefined) {
      return base as Array<Envelope<unknown>>;
    }
    return base.filter((e) => e.definition.type === definition.type) as Array<Envelope<unknown>>;
  }

  history(): ReadonlyArray<Envelope<unknown>> {
    return this.historyStore.snapshot() as Array<Envelope<unknown>>;
  }

  clearHistory(): void {
    this.historyStore.clear();
  }

  use(middleware: Middleware): void {
    this.middlewares = [...this.middlewares, middleware];
    this.composed = this.compose();
  }

  metrics(): BusMetrics {
    return {
      published: this.published,
      delivered: this.delivered,
      dropped: this.dropped,
      historySize: this.historyStore.size,
      subscriberCount: this.subscriberCount(),
      failedHandlers: this.failedHandlers,
      lastPublishMicros: this.lastPublishMicros,
    };
  }

  dispose(): void {
    this.handlers.clear();
    this.wildcard.length = 0;
    this.historyStore.clear();
  }

  // --- internal -----------------------------------------------------------

  private subscriberCount(): number {
    let total = this.wildcard.length;
    for (const list of this.handlers.values()) {
      total += list.length;
    }
    return total;
  }

  private insert(type: string, entry: HandlerEntry): void {
    if (type === '*') {
      this.insertSorted(this.wildcard, entry);
      return;
    }
    const list = this.handlers.get(type) ?? this.createList(type);
    this.insertSorted(list, entry);
  }

  private insertSorted(list: Array<HandlerEntry>, entry: HandlerEntry): void {
    let index = list.length;
    while (index > 0 && (list[index - 1]?.priority ?? Number.NEGATIVE_INFINITY) < entry.priority) {
      index--;
    }
    list.splice(index, 0, entry);
  }

  private remove(type: string, handler: EventHandler<unknown>): void {
    const list = this.handlers.get(type);
    if (list !== undefined) {
      const index = list.findIndex((entry) => entry.handler === handler);
      if (index >= 0) {
        list.splice(index, 1);
      }
    }
    const wildIndex = this.wildcard.findIndex((entry) => entry.handler === handler);
    if (wildIndex >= 0) {
      this.wildcard.splice(wildIndex, 1);
    }
  }

  private createList(type: string): Array<HandlerEntry> {
    const list: Array<HandlerEntry> = [];
    this.handlers.set(type, list);
    return list;
  }

  private disposableFor(type: string, entry: HandlerEntry): Disposable {
    return {
      dispose: () => {
        this.remove(type, entry.handler);
      },
    };
  }

  /**
   * Build (and cache) the middleware chain ending in the delivery link. The
   * chain reads {@link activeContext}, set per publish, so the chain itself is
   * built once and reused across publishes.
   */
  private compose(): (context: MiddlewareContext) => Promise<void> {
    const chain = this.middlewares;
    const deliver: () => Promise<void> = async () => {
      await this.deliver();
    };

    if (chain.length === 0) {
      return () => deliver();
    }

    let previous: () => Promise<void> = deliver;
    for (let i = chain.length - 1; i >= 0; i--) {
      const middleware = chain[i] as Middleware;
      const next = previous;
      previous = () => {
        const context = this.activeContext;
        if (context === null) {
          return Promise.resolve();
        }
        return middleware(context, next);
      };
    }
    return () => previous();
  }

  /** Deliver the active envelope to all matching handlers, in priority order. */
  private async deliver(): Promise<void> {
    const context = this.activeContext;
    if (context === null) {
      return;
    }
    if (context.cancelled) {
      context.metrics.dropped = true;
      return;
    }

    const envelope = context.envelope;
    const type = envelope.definition.type;
    const specific = this.handlers.get(type);
    const targets: Array<HandlerEntry> = [];
    if (specific !== undefined) {
      targets.push(...specific);
    }
    targets.push(...this.wildcard);

    if (targets.length === 0) {
      return;
    }

    const failures: unknown[] = [];
    for (const entry of targets) {
      if (entry.once) {
        this.remove(type, entry.handler);
      }
      try {
        await entry.handler(envelope as Envelope<unknown>);
      } catch (error) {
        failures.push(error);
        context.metrics.failedHandlers++;
      }
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, `Event handlers failed for "${type}"`);
    }
  }
}
