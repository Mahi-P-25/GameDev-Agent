import type { Timestamp, UUID } from '@gamedev-agent/shared';
import type { Clock, EventDefinition, EventMetadata, IdGenerator, PublishOptions } from './types';

/**
 * Single allocation point for event metadata. Uses the injected {@link Clock}
 * and {@link IdGenerator} so no caller constructs timestamps or ids by hand and
 * the bus keeps a single, testable source of truth for both.
 */
export function buildMetadata(
  definition: EventDefinition<unknown>,
  source: string,
  clock: Clock,
  idGenerator: IdGenerator,
  options?: PublishOptions,
): EventMetadata {
  const priority = options?.priority ?? 'normal';
  const correlationId: UUID | null = options?.correlationId ?? null;
  const trace = options?.trace;
  return {
    eventId: idGenerator.generate() as UUID,
    timestamp: clock.now() as Timestamp,
    source,
    correlationId,
    priority,
    version: definition.version,
    ...(trace !== undefined ? { trace } : {}),
  };
}
