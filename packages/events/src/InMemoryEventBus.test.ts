import { describe, expect, it } from 'vitest';
import { InMemoryEventBus } from './InMemoryEventBus';
import { KernelBootCompleted, KernelBootStarted } from './catalog';

describe('InMemoryEventBus — legacy dual-mode shim', () => {
  it('supports emit/on with a string event type (legacy envelope)', async () => {
    const bus = new InMemoryEventBus('test');
    let got: unknown;
    bus.on('legacy.string', (env) => {
      got = env.payload;
    });
    await bus.emit('legacy.string', { a: 1 });
    expect(got).toEqual({ a: 1 });
  });

  it('supports emit/on with an EventDefinition (typed)', async () => {
    const bus = new InMemoryEventBus('test');
    let got = '';
    bus.on(KernelBootStarted, (env) => {
      got = env.payload.namespace;
    });
    await bus.emit(KernelBootStarted, { namespace: 'ns-7' });
    expect(got).toBe('ns-7');
  });

  it('legacy once fires only once', async () => {
    const bus = new InMemoryEventBus('test');
    let count = 0;
    bus.once('legacy.once', () => {
      count += 1;
    });
    await bus.emit('legacy.once', 1);
    await bus.emit('legacy.once', 2);
    expect(count).toBe(1);
  });

  it('legacy unsubscribe stops delivery', async () => {
    const bus = new InMemoryEventBus('test');
    let count = 0;
    const sub = bus.on('legacy.un', () => {
      count += 1;
    });
    await bus.emit('legacy.un', 1);
    sub.dispose();
    await bus.emit('legacy.un', 2);
    expect(count).toBe(1);
  });

  it('v2 methods coexist: publish + replay', async () => {
    const bus = new InMemoryEventBus('test', { historySize: 4 });
    bus.subscribe(KernelBootCompleted, () => undefined);
    await bus.publish(KernelBootCompleted, { namespace: 'n', durationMs: 1 });
    expect(bus.replay(KernelBootCompleted)).toHaveLength(1);
  });
});

describe('EventBusContract — core metrics', () => {
  it('tracks published and delivered counts', async () => {
    const bus = new InMemoryEventBus('test');
    bus.subscribe(KernelBootStarted, () => undefined);
    await bus.publish(KernelBootStarted, { namespace: 'n' });
    const m = bus.metrics();
    expect(m.published).toBe(1);
    expect(m.delivered).toBe(1);
  });
});
