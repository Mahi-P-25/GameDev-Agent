import { InMemoryEventBus } from '@gamedev-agent/events';
import { describe, expect, it, vi } from 'vitest';
import { Lifecycle } from './Lifecycle';
import { LIFECYCLE_EVENTS } from './events';
import { LIFECYCLE_STAGES, type LifecycleStage } from './types';

/** A logger that records calls; lets tests assert on lifecycle logging. */
function fakeLogger() {
  const calls: Array<{ level: string; message: string }> = [];
  const noop = (level: string) => (message: string) => calls.push({ level, message });
  return {
    calls,
    logger: {
      namespace: 'test',
      trace: noop('trace'),
      debug: noop('debug'),
      info: noop('info'),
      warn: noop('warn'),
      error: noop('error'),
      fatal: noop('fatal'),
      child: () => fakeLogger().logger,
    } as never,
  };
}

function makeLifecycle() {
  const bus = new InMemoryEventBus('test');
  const { logger, calls } = fakeLogger();
  const lifecycle = new Lifecycle(bus, logger, 'test');
  return { bus, lifecycle, calls };
}

describe('Lifecycle engine', () => {
  it('enforces strict stage ordering', async () => {
    const { lifecycle } = makeLifecycle();
    await lifecycle.run('bootstrap', () => {});
    // Skipping 'config' and going straight to 'logger' must be rejected.
    await expect(lifecycle.run('logger', () => {})).rejects.toThrow(/Lifecycle order violation/);
    expect(lifecycle.current).toBe('bootstrap');
  });

  it('runs the action and records history in order', async () => {
    const { lifecycle } = makeLifecycle();
    const order: string[] = [];
    await lifecycle.run('bootstrap', () => {
      order.push('action:bootstrap');
    });
    await lifecycle.run('config', () => {
      order.push('action:config');
    });
    expect(order).toEqual(['action:bootstrap', 'action:config']);
    expect(lifecycle.records.map((r) => r.stage)).toEqual(['bootstrap', 'config']);
    expect(lifecycle.records[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('emits stage-enter and stage-exit events with payloads', async () => {
    const { bus, lifecycle } = makeLifecycle();
    const enters: Array<{
      stage: LifecycleStage;
      index: number;
      namespace: string;
      timestamp: number;
    }> = [];
    const exits: Array<{ stage: LifecycleStage; durationMs: number }> = [];
    await bus.on(LIFECYCLE_EVENTS.stageEnter, (e) => {
      enters.push(e.payload as never);
    });
    await bus.on(LIFECYCLE_EVENTS.stageExit, (e) => {
      exits.push(e.payload as never);
    });

    await lifecycle.run('bootstrap', () => {});

    expect(enters).toEqual([
      { stage: 'bootstrap', index: 0, namespace: 'test', timestamp: expect.any(Number) },
    ]);
    expect(exits).toHaveLength(1);
    expect(exits[0]?.stage).toBe('bootstrap');
    expect(typeof exits[0]?.durationMs).toBe('number');
  });

  it('runs registered hooks after the stage action', async () => {
    const { lifecycle } = makeLifecycle();
    const order: string[] = [];
    lifecycle.on('bootstrap', () => {
      order.push('hook');
    });
    await lifecycle.run('bootstrap', () => {
      order.push('action');
    });
    expect(order).toEqual(['action', 'hook']);
  });

  it('allows a hook to be registered before its stage is reached', async () => {
    const { lifecycle } = makeLifecycle();
    const readyRan: boolean[] = [false];
    // Registered during 'bootstrap' (via run action) but targeted at 'ready'.
    await lifecycle.run('bootstrap', () => {
      lifecycle.on('ready', () => {
        readyRan[0] = true;
      });
    });
    await lifecycle.run('config', () => {});
    await lifecycle.run('logger', () => {});
    await lifecycle.run('dependency-injection', () => {});
    await lifecycle.run('service-registry', () => {});
    await lifecycle.run('event-bus', () => {});
    await lifecycle.run('ready', () => {});
    expect(readyRan[0]).toBe(true);
  });

  it('detaches a hook when its disposable is disposed', async () => {
    const { lifecycle } = makeLifecycle();
    const count = vi.fn();
    const subscription = lifecycle.on('bootstrap', count);
    subscription.dispose();
    await lifecycle.run('bootstrap', () => {});
    expect(count).not.toHaveBeenCalled();
  });

  it('faults the stage and emits a fault event when the action throws', async () => {
    const { bus, lifecycle } = makeLifecycle();
    const faults: string[] = [];
    await bus.on(LIFECYCLE_EVENTS.fault, (e) => {
      faults.push((e.payload as { error: string }).error);
    });

    const rejection = lifecycle.run('bootstrap', () => {
      throw new Error('boom');
    });
    await expect(rejection).rejects.toThrow('boom');
    expect(lifecycle.isFaulted).toBe(true);
    expect(faults).toEqual(['boom']);
    expect(lifecycle.records).toHaveLength(0);
  });

  it('faults when a hook throws, and runs remaining hooks first', async () => {
    const { lifecycle } = makeLifecycle();
    const ran: string[] = [];
    lifecycle.on('bootstrap', () => {
      ran.push('first');
    });
    lifecycle.on('bootstrap', () => {
      ran.push('second');
      throw new Error('hook-boom');
    });
    lifecycle.on('bootstrap', () => {
      ran.push('third');
    });
    await expect(lifecycle.run('bootstrap', () => {})).rejects.toThrow('hook-boom');
    // All hooks run before the first failure is propagated.
    expect(ran).toEqual(['first', 'second', 'third']);
  });

  it('exposes the canonical stage order', () => {
    expect(LIFECYCLE_STAGES).toEqual([
      'bootstrap',
      'config',
      'logger',
      'dependency-injection',
      'service-registry',
      'event-bus',
      'ready',
      'running',
      'halt',
    ]);
  });
});
