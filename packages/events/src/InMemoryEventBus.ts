import type { Disposable } from '@gamedev-agent/shared';
import { EventBus as EventBusImpl } from './EventBus';
import type { LegacyEnvelope, LegacyHandler } from './LegacyEventBus';
import { legacyDefinition } from './LegacyEventBus';
import type {
  Envelope,
  EventBusContract,
  EventBusOptions,
  EventDefinition,
  EventHandler,
} from './types';

/**
 * In-process reference implementation of the v2 {@link EventBus} — the kernel's
 * default message backbone. It is a thin, allocation-light wrapper that forwards
 * the v2 API to an internal {@link EventBusImpl} and, for backward
 * compatibility during the migration, also exposes the deprecated legacy
 * `emit`/`on`/`once` string-based methods (delegating to typed publish/
 * subscribe). New code should use the v2 API directly.
 *
 * @deprecated Construct {@link EventBusImpl} directly for new code.
 */
export class InMemoryEventBus implements EventBusContract {
  private readonly bus: EventBusContract;

  constructor(source: string, options?: Omit<EventBusOptions, 'source'>) {
    this.bus = new EventBusImpl({ source, ...options });
  }

  publish<T>(
    definition: EventDefinition<T>,
    payload: T,
    options?: Parameters<EventBusContract['publish']>[2],
  ): Promise<void> {
    return this.bus.publish(definition, payload, options);
  }

  subscribe<T>(
    definition: EventDefinition<T>,
    handler: EventHandler<T>,
    options?: Parameters<EventBusContract['subscribe']>[2],
  ): Disposable {
    return this.bus.subscribe(definition, handler, options);
  }

  once<T>(
    typeOrDefinition: string | EventDefinition<T>,
    handler: LegacyHandler<T> | EventHandler<T>,
  ): Disposable {
    if (typeof typeOrDefinition === 'string') {
      const definition = legacyDefinition<T>(typeOrDefinition);
      return this.bus.once(definition, (envelope) =>
        (handler as LegacyHandler<T>)({
          type: envelope.definition.type,
          payload: envelope.payload as T,
          timestamp: envelope.metadata.timestamp,
          source: envelope.metadata.source,
        }),
      );
    }
    return this.bus.once(typeOrDefinition, handler as EventHandler<T>);
  }

  unsubscribe<T>(definition: EventDefinition<T>, handler: EventHandler<T>): void {
    this.bus.unsubscribe(definition, handler);
  }

  replay<T>(definition?: EventDefinition<T>, since?: number): Array<Envelope<unknown>> {
    return this.bus.replay(definition, since);
  }

  history(): ReadonlyArray<Envelope<unknown>> {
    return this.bus.history();
  }

  clearHistory(): void {
    this.bus.clearHistory();
  }

  use(middleware: Parameters<EventBusContract['use']>[0]): void {
    this.bus.use(middleware);
  }

  metrics(): ReturnType<EventBusContract['metrics']> {
    return this.bus.metrics();
  }

  dispose(): void {
    this.bus.dispose();
  }

  // --- legacy shim ----------------------------------------------------------
  // Accepts either a raw string `type` (pre-Sprint-3) or a typed
  // {@link EventDefinition} (post-migration), bridging both call styles.

  emit<T>(type: string | EventDefinition<T>, payload: T): Promise<void> {
    const definition = typeof type === 'string' ? legacyDefinition<T>(type) : type;
    return this.bus.publish(definition, payload);
  }

  on<T>(type: string | EventDefinition<T>, handler: LegacyHandler<T>): Disposable {
    const definition = typeof type === 'string' ? legacyDefinition<T>(type) : type;
    return this.bus.subscribe(definition, (envelope) => handler(toLegacy(envelope)));
  }
}

function toLegacy<T>(envelope: Envelope<T>): LegacyEnvelope<T> {
  return {
    type: envelope.definition.type,
    payload: envelope.payload,
    timestamp: envelope.metadata.timestamp,
    source: envelope.metadata.source,
  };
}
