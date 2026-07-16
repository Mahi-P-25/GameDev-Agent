import type {
  Envelope,
  EventDefinition,
  Middleware,
  MiddlewareContext,
  NextFn,
  TraceContext,
} from './types';

/**
 * Middleware are composable links applied to every published event, in
 * registration order, before it reaches subscribers. The final link in the chain
 * is supplied by the bus and performs actual delivery.
 *
 * A middleware may:
 *  - **log** the envelope (or only on failure),
 *  - **filter** by dropping events it does not care about,
 *  - **transform** the envelope (e.g. enrich metadata, redact payload),
 *  - **block** delivery outright (set `context.cancelled = true`),
 *  - **trace** by opening/continuing a {@link TraceContext},
 *  - **measure** by recording execution time.
 *
 * All middleware receive the same {@link MiddlewareContext} and call `next()`
 * to advance the chain. Skipping `next()` short-circuits delivery.
 */

/** Logs every envelope that passes through. `sink` receives the envelope. */
export function createLoggingMiddleware(sink: (envelope: Envelope<unknown>) => void): Middleware {
  return async (context: MiddlewareContext, next: NextFn): Promise<void> => {
    sink(context.envelope);
    await next();
  };
}

/**
 * Drops (cancels) events for which `predicate` returns `false`. Use to build
 * a coarse pre-filter so downstream handlers never see irrelevant traffic.
 */
export function createFilterMiddleware(
  predicate: (envelope: Envelope<unknown>) => boolean,
): Middleware {
  return async (context: MiddlewareContext, next: NextFn): Promise<void> => {
    if (predicate(context.envelope)) {
      await next();
    } else {
      context.cancelled = true;
    }
  };
}

/**
 * Rewrites the envelope before delivery. The returned envelope replaces the
 * context's envelope for all subsequent links and subscribers. Enrich, redact,
 * or re-prioritize here.
 */
export function createTransformMiddleware(
  transform: (envelope: Envelope<unknown>) => Envelope<unknown>,
): Middleware {
  return async (context: MiddlewareContext, next: NextFn): Promise<void> => {
    context.envelope = transform(context.envelope);
    await next();
  };
}

/**
 * Blocks delivery when `predicate` matches, marking the event cancelled. Unlike
 * a filter, the contract is "block if matched" (deny-list semantics).
 */
export function createBlockMiddleware(
  predicate: (envelope: Envelope<unknown>) => boolean,
): Middleware {
  return async (context: MiddlewareContext, next: NextFn): Promise<void> => {
    if (predicate(context.envelope)) {
      context.cancelled = true;
      return;
    }
    await next();
  };
}

/**
 * Attaches or continues a {@link TraceContext}. `makeSpan` is called with the
 * current envelope and must return the span to record on `metadata.trace`.
 */
export function createTraceMiddleware(
  makeSpan: (envelope: Envelope<unknown>) => TraceContext,
): Middleware {
  return async (context: MiddlewareContext, next: NextFn): Promise<void> => {
    context.envelope = {
      ...context.envelope,
      metadata: { ...context.envelope.metadata, trace: makeSpan(context.envelope) },
    };
    await next();
  };
}

/**
 * Records delivery duration via `onMeasure(envelope, micros)`. Uses the
 * `startedAt` the bus stamps on the metrics so the cost of the whole chain
 * (incl. subscribers) is captured, not just this link.
 */
export function createMeasureMiddleware(
  onMeasure: (envelope: Envelope<unknown>, micros: number) => void,
): Middleware {
  return async (context: MiddlewareContext, next: NextFn): Promise<void> => {
    const started = context.metrics.startedAt;
    await next();
    const elapsedMicros = (performance.now() - started) * 1000;
    onMeasure(context.envelope, elapsedMicros);
  };
}

/** Helper: build a wildcard-priority-aware matcher used by block/filter. */
export function matchDefinition<T>(
  envelope: Envelope<unknown>,
  definition: EventDefinition<T>,
): boolean {
  return envelope.definition.type === definition.type;
}

/** No-op middleware (useful as a default / placeholder in composition). */
export function noopMiddleware(): Middleware {
  return async (_context: MiddlewareContext, next: NextFn): Promise<void> => {
    await next();
  };
}
