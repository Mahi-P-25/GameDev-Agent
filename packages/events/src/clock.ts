import { createServiceToken } from '@gamedev-agent/di';
import type { Clock, IdGenerator } from './types';

/**
 * Production {@link Clock} backed by `Date.now()`. Injected into the bus so the
 * kernel never calls `Date.now()` directly — time is frozen in tests and the bus
 * stays portable to non-Node runtimes.
 */
export const SystemClock: Clock = {
  now: () => Date.now(),
};

/**
 * Production {@link IdGenerator} backed by `crypto.randomUUID()`. Injected so the
 * bus never touches `crypto` directly; tests supply a deterministic generator.
 */
export const UuidGenerator: IdGenerator = {
  generate: () => crypto.randomUUID(),
};

/**
 * DI token for a {@link Clock}. The kernel registers {@link SystemClock} (or a
 * test double) and the bus resolves it; `events` never imports `kernel`, so the
 * dependency edge stays `events → di` only.
 */
export const CLOCK_TOKEN = createServiceToken<Clock>('events.clock');

/**
 * DI token for an {@link IdGenerator}. See {@link CLOCK_TOKEN}.
 */
export const ID_GENERATOR_TOKEN = createServiceToken<IdGenerator>('events.id-generator');
