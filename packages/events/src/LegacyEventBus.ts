import type { Disposable } from '@gamedev-agent/shared';
import type { EventBusContract as EventBusV2, EventDefinition } from './types';

/**
 * @deprecated Use the v2 {@link EventBus} (`publish`/`subscribe`) and typed
 * {@link EventDefinition}s instead. This shim exists only so existing callers
 * (notably the kernel's lifecycle engine) keep compiling while they migrate.
 *
 * The legacy contract wraps an untyped string `type` and a raw `payload`.
 */
export interface LegacyEventBus extends Disposable {
  emit<T>(type: string, payload: T): Promise<void>;
  on<T>(type: string, handler: LegacyHandler<T>): Disposable;
  once<T>(type: string, handler: LegacyHandler<T>): Disposable;
}

/** @deprecated Legacy envelope passed to legacy handlers. */
export interface LegacyEnvelope<T> {
  readonly type: string;
  readonly payload: T;
  readonly timestamp: number;
  readonly source: string;
}

/** @deprecated Legacy handler signature. */
export type LegacyHandler<T> = (envelope: LegacyEnvelope<T>) => void | Promise<void>;

/**
 * Adapts a v2 {@link EventBus} to the legacy string-based contract. Each
 * legacy `type` becomes an {@link EventDefinition} at version 1; legacy
 * `on`/`once` wrap the v2 subscriber and re-shape the envelope back into the
 * legacy shape. This keeps the migration mechanical and loss-less.
 */
export class LegacyEventBusAdapter implements LegacyEventBus {
  constructor(private readonly bus: EventBusV2) {}

  async emit<T>(type: string, payload: T): Promise<void> {
    const definition = legacyDefinition<T>(type);
    await this.bus.publish(definition, payload);
  }

  on<T>(type: string, handler: LegacyHandler<T>): Disposable {
    const definition = legacyDefinition<T>(type);
    return this.bus.subscribe(definition, (envelope) => {
      return handler({
        type: envelope.definition.type,
        payload: envelope.payload as T,
        timestamp: envelope.metadata.timestamp,
        source: envelope.metadata.source,
      });
    });
  }

  once<T>(type: string, handler: LegacyHandler<T>): Disposable {
    const definition = legacyDefinition<T>(type);
    return this.bus.once(definition, (envelope) => {
      return handler({
        type: envelope.definition.type,
        payload: envelope.payload as T,
        timestamp: envelope.metadata.timestamp,
        source: envelope.metadata.source,
      });
    });
  }

  dispose(): void {
    this.bus.dispose();
  }
}

const legacyCache = new Map<string, EventDefinition<unknown>>();

export function legacyDefinition<T>(type: string): EventDefinition<T> {
  let cached = legacyCache.get(type);
  if (cached === undefined) {
    cached = { type, version: 1 } as EventDefinition<unknown>;
    legacyCache.set(type, cached);
  }
  return cached as EventDefinition<T>;
}
