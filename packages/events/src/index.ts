/**
 * Legacy envelope (pre-Sprint-3). Kept for backward compatibility with callers
 * that still use the string-based legacy bus (`emit`/`on`). New code should use
 * the typed {@link Envelope} and {@link EventDefinition} instead.
 *
 * @deprecated Use `Envelope<T>` from the v2 API.
 */
export interface EventEnvelope<T> {
  readonly type: string;
  readonly payload: T;
  readonly timestamp: number;
  readonly source: string;
}

/** @deprecated Use `EventHandler<T>` (v2) — handler of a typed {@link Envelope}. */
export type EventHandlerLegacy<T> = (envelope: EventEnvelope<T>) => void | Promise<void>;

// --- v2 production API -------------------------------------------------------
export { EventBus } from './EventBus';
export type { EventBusContract } from './types';
export type {
  BusMetrics,
  Clock,
  CorrelationSource,
  Envelope,
  EventBusOptions,
  EventDefinition,
  EventHandler,
  EventMetadata,
  EventPriority,
  IdGenerator,
  Middleware,
  MiddlewareContext,
  NextFn,
  PublishMetrics,
  PublishOptions,
  SubscribeOptions,
  TraceContext,
} from './types';
export { PRIORITY_WEIGHT } from './types';

export { SystemClock, UuidGenerator, CLOCK_TOKEN, ID_GENERATOR_TOKEN } from './clock';
export { buildMetadata } from './metadata';
export { EventHistory } from './history';
export {
  createLoggingMiddleware,
  createFilterMiddleware,
  createTransformMiddleware,
  createBlockMiddleware,
  createTraceMiddleware,
  createMeasureMiddleware,
  noopMiddleware,
  matchDefinition,
} from './middleware';

// --- legacy shim (kept during migration) -------------------------------------
export { InMemoryEventBus } from './InMemoryEventBus';
export type {
  LegacyEventBus,
  LegacyEnvelope,
  LegacyHandler,
} from './LegacyEventBus';
export { LegacyEventBusAdapter } from './LegacyEventBus';

// --- typed event catalog ------------------------------------------------------
export * from './catalog';
