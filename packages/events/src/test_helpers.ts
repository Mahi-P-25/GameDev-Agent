import type { UUID } from '@gamedev-agent/shared';
import { EventBus } from './EventBus';
import type { Clock, IdGenerator } from './types';

/** Deterministic clock: controllable, monotonically increasing time. */
export class FakeClock implements Clock {
  private value = 1_000_000;
  now(): number {
    this.value += 1;
    return this.value;
  }
  set(value: number): void {
    this.value = value;
  }
}

/** Deterministic id generator: stable, ordered, unique ids. */
export class FakeIdGenerator implements IdGenerator {
  private counter = 0;
  generate(): string {
    this.counter += 1;
    return `id-${this.counter}` as UUID;
  }
  get count(): number {
    return this.counter;
  }
}

export interface BusHarness {
  bus: EventBus;
  clock: FakeClock;
  ids: FakeIdGenerator;
}

export function makeBus(historySize = 16): BusHarness {
  const clock = new FakeClock();
  const ids = new FakeIdGenerator();
  const bus = new EventBus({ source: 'test', clock, idGenerator: ids, historySize });
  return { bus, clock, ids };
}
