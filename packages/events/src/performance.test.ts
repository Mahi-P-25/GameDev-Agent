import { makeBus } from './test_helpers';

import { describe, expect, it } from 'vitest';

const Ping = { type: 'perf.ping', version: 1 } as EventDefinition<number>;

describe('EventBus — performance', () => {
  it('publishes 10k events to many subscribers efficiently', async () => {
    const { bus } = makeBus(0);
    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < counts.length; i += 1) {
      const idx = i;
      bus.subscribe(Ping, () => {
        counts[idx] = (counts[idx] ?? 0) + 1;
      });
    }
    const start = Date.now();
    const total = 10_000;
    for (let i = 0; i < total; i += 1) {
      await bus.publish(Ping, i);
    }
    const elapsed = Date.now() - start;
    expect(counts.every((c) => c === total)).toBe(true);
    expect(bus.metrics().delivered).toBe(total);
    expect(elapsed).toBeLessThan(5000);
  });
});

import type { EventDefinition } from './types';
