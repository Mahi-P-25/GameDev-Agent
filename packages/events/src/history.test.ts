import { makeBus } from './test_helpers';

import { describe, expect, it } from 'vitest';

const A = def<number>('test.a');
const B = def<number>('test.b');

function def<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

describe('EventBus — history & replay', () => {
  it('records published events into history', async () => {
    const { bus } = makeBus(8);
    await bus.publish(A, 1);
    await bus.publish(A, 2);
    const history = bus.history();
    expect(history).toHaveLength(2);
    expect(history[0]?.payload).toBe(1);
    expect(history[1]?.payload).toBe(2);
  });

  it('evicts oldest when capacity is exceeded (ring buffer)', async () => {
    const { bus } = makeBus(2);
    await bus.publish(A, 1);
    await bus.publish(A, 2);
    await bus.publish(A, 3);
    const history = bus.history();
    expect(history).toHaveLength(2);
    expect(history.map((e) => e.payload)).toEqual([2, 3]);
  });

  it('disables history when historySize is 0', async () => {
    const { bus } = makeBus(0);
    await bus.publish(A, 1);
    expect(bus.history()).toHaveLength(0);
    expect(bus.metrics().historySize).toBe(0);
  });

  it('replays all events in order', async () => {
    const { bus } = makeBus(8);
    await bus.publish(A, 1);
    await bus.publish(B, 10);
    await bus.publish(A, 2);
    const replayed = bus.replay();
    expect(replayed.map((e) => e.payload)).toEqual([1, 10, 2]);
  });

  it('replays filtered by event definition', async () => {
    const { bus } = makeBus(8);
    await bus.publish(A, 1);
    await bus.publish(B, 10);
    await bus.publish(A, 2);
    const replayed = bus.replay(A);
    expect(replayed.map((e) => e.payload)).toEqual([1, 2]);
  });

  it('replays filtered by since timestamp', async () => {
    const { bus, clock } = makeBus(8);
    clock.set(100);
    await bus.publish(A, 1);
    clock.set(200);
    await bus.publish(A, 2);
    const replayed = bus.replay(undefined, 150);
    expect(replayed.map((e) => e.payload)).toEqual([2]);
  });

  it('clearHistory empties the buffer and metric', async () => {
    const { bus } = makeBus(8);
    await bus.publish(A, 1);
    bus.clearHistory();
    expect(bus.history()).toHaveLength(0);
    expect(bus.metrics().historySize).toBe(0);
  });
});

import type { EventDefinition } from './types';
