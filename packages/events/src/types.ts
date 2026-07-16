import type { Disposable, Timestamp, UUID } from '@gamedev-agent/shared';

/**
 * Severity ordering for events. Higher priority handlers run first so that
 * critical work (e.g. shutdown, incident escalation) is never starved by
 * low-priority observers (e.g. analytics).
 */
export type EventPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Numeric weight backing {@link EventPriority}. Handlers are dispatched in
 * descending order of this value.
 */
export const PRIORITY_WEIGHT: Readonly<Record<EventPriority, number>> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
} as const;

/**
 * Span/trace context attached to an event when distributed tracing is enabled.
 * Carries the open trace/span identifiers so a handler can continue a trace.
 */
export interface TraceContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
}

/**
 * Mandatory envelope metadata. Every event on the bus carries this so it can be
 * correlated, ordered, replayed, and observed without the payload knowing
 * anything about the infrastructure.
 */
export interface EventMetadata {
  /** Stable, unique identifier for this specific event emission. */
  readonly eventId: UUID;
  /** Emission time, milliseconds since epoch (from the injected {@link Clock}). */
  readonly timestamp: Timestamp;
  /** Producing package/namespace, enabling routing and isolation. */
  readonly source: string;
  /** Links this event to a causal chain (request, mission, run). */
  readonly correlationId: UUID | null;
  /** Dispatch priority (see {@link PRIORITY_WEIGHT}). */
  readonly priority: EventPriority;
  /** Schema version of the event definition, for evolution. */
  readonly version: number;
  /** Optional tracing context. */
  readonly trace?: TraceContext;
}

/**
 * A fully-typed event contract. `type` is the stable, non-magic routing key;
 * `version` allows payload evolution without breaking subscribers.
 */
export interface EventDefinition<T> {
  readonly type: string;
  readonly version: number;
  /** Optional guard so malformed payloads fail at the boundary, never downstream. */
  readonly validate?: (payload: T) => boolean;
}

/**
 * The unit delivered to subscribers: the definition, its metadata, and the
 * domain payload. Subscribers read `payload` and use `metadata` for tracing,
 * correlation, and priority-aware handling.
 */
export interface Envelope<T> {
  readonly definition: EventDefinition<T>;
  readonly metadata: EventMetadata;
  readonly payload: T;
}

/** A subscriber callback. May be sync or async; a rejection faults the publish. */
export type EventHandler<T> = (envelope: Envelope<T>) => void | Promise<void>;

/** Source from which another event can be correlated. */
export type CorrelationSource = { readonly correlationId?: UUID | null };

/**
 * Options for a single {@link EventBus.publish} call, allowing per-emission
 * override of priority and correlation without redefining the event.
 */
export interface PublishOptions {
  readonly priority?: EventPriority;
  readonly correlationId?: UUID | null;
  readonly trace?: TraceContext;
}

/** Per-subscription options. */
export interface SubscribeOptions {
  readonly priority?: EventPriority;
}

/**
 * Context threaded through the middleware chain. Middleware may read the
 * envelope, mark the event cancelled (so it is never delivered to handlers),
 * or mutate the envelope before the next link runs.
 */
export interface MiddlewareContext {
  envelope: Envelope<unknown>;
  cancelled: boolean;
  readonly metrics: PublishMetrics;
}

/** A single link in the middleware chain. */
export type Middleware = (context: MiddlewareContext, next: NextFn) => Promise<void>;

/** Continues the chain; the final link delivers to subscribers. */
export type NextFn = () => Promise<void>;

/**
 * Live, observable counters for the bus. Read via {@link EventBus.metrics}.
 */
export interface BusMetrics {
  /** Total events published (including cancelled/dropped). */
  readonly published: number;
  /** Events delivered to at least one handler. */
  readonly delivered: number;
  /** Events cancelled by middleware before delivery. */
  readonly dropped: number;
  /** Events currently retained in the history buffer. */
  readonly historySize: number;
  /** Currently registered handler entries. */
  readonly subscriberCount: number;
  /** Handlers that threw during the last publish. */
  readonly failedHandlers: number;
  /** Wall-clock microseconds of the last publish (incl. middleware + dispatch). */
  readonly lastPublishMicros: number;
}

/**
 * Metrics captured for one publish, available to middleware (e.g. measure).
 */
export interface PublishMetrics {
  readonly startedAt: number;
  subscriberCount: number;
  dropped: boolean;
  failedHandlers: number;
}

/**
 * Production-ready clock. Injected so time can be frozen in tests and so the
 * bus never touches `Date.now()` directly (portability + deterministic replay).
 */
export interface Clock {
  now(): number;
}

/**
 * Identifier generator. Injected so ids can be made deterministic in tests and
 * so the bus never touches `crypto.randomUUID()` directly.
 */
export interface IdGenerator {
  generate(): string;
}

/**
 * Construction options for the production {@link EventBus}.
 */
export interface EventBusOptions {
  /** Producing package/namespace stamped on every emitted event. */
  readonly source: string;
  /** Maximum retained events; 0 disables history. Default 1024. */
  readonly historySize?: number;
  /** Middleware applied to every published event, in order. */
  readonly middlewares?: ReadonlyArray<Middleware>;
  /** Clock; defaults to {@link SystemClock}. */
  readonly clock?: Clock;
  /** Id generator; defaults to {@link UuidGenerator}. */
  readonly idGenerator?: IdGenerator;
}

/**
 * The production event bus contract — the single communication backbone between
 * major packages. Packages publish and subscribe typed {@link EventDefinition}s;
 * they never call each other directly.
 */
export interface EventBusContract extends Disposable {
  publish<T>(definition: EventDefinition<T>, payload: T, options?: PublishOptions): Promise<void>;
  subscribe<T>(
    definition: EventDefinition<T>,
    handler: EventHandler<T>,
    options?: SubscribeOptions,
  ): Disposable;
  once<T>(definition: EventDefinition<T>, handler: EventHandler<T>): Disposable;
  unsubscribe<T>(definition: EventDefinition<T>, handler: EventHandler<T>): void;
  /**
   * Replay recorded events. Without arguments replays everything in order;
   * `definition` filters by exact event type, `since` filters by timestamp.
   */
  replay<T>(definition?: EventDefinition<T>, since?: number): Array<Envelope<unknown>>;
  /** Snapshot of the retained history (oldest → newest). */
  history(): ReadonlyArray<Envelope<unknown>>;
  /** Drop all retained history. */
  clearHistory(): void;
  /** Register middleware after construction. */
  use(middleware: Middleware): void;
  /** Observable counters for operations/observability. */
  metrics(): BusMetrics;
}
