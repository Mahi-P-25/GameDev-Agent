import { describe, expect, it } from 'vitest';
import { makeBus } from './test_helpers';
import type { EventDefinition, MiddlewareContext, NextFn } from './types';

const Ping = def<string>('test.ping');
const Pong = def<{ value: number }>('test.pong');

function def<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

describe('EventBus — publish / subscribe', () => {
  it('delivers a published event to a subscriber with full metadata', async () => {
    const { bus, ids } = makeBus();
    const received: Array<unknown> = [];
    bus.subscribe(Ping, (env) => {
      received.push(env.payload);
      expect(env.metadata.eventId).toBe('id-1');
      expect(env.metadata.source).toBe('test');
      expect(env.metadata.version).toBe(1);
      expect(env.metadata.priority).toBe('normal');
      expect(typeof env.metadata.timestamp).toBe('number');
    });

    await bus.publish(Ping, 'hello');
    expect(received).toEqual(['hello']);
    expect(ids.count).toBe(1);
  });

  it('supports synchronous handlers', async () => {
    const { bus } = makeBus();
    let side = 0;
    bus.subscribe(Ping, () => {
      side += 1;
    });
    await bus.publish(Ping, 'x');
    expect(side).toBe(1);
  });

  it('awaits asynchronous handlers before resolving', async () => {
    const { bus } = makeBus();
    let resolved = false;
    bus.subscribe(Ping, async () => {
      await new Promise((r) => setTimeout(r, 10));
      resolved = true;
    });
    await bus.publish(Ping, 'x');
    expect(resolved).toBe(true);
  });

  it('delivers to multiple subscribers', async () => {
    const { bus } = makeBus();
    const order: string[] = [];
    bus.subscribe(Ping, () => {
      order.push('a');
    });
    bus.subscribe(Ping, () => {
      order.push('b');
    });
    await bus.publish(Ping, 'x');
    expect(order).toEqual(['a', 'b']);
  });

  it('unsubscribe stops further delivery', async () => {
    const { bus } = makeBus();
    let count = 0;
    const sub = bus.subscribe(Ping, () => {
      count += 1;
    });
    await bus.publish(Ping, '1');
    sub.dispose();
    await bus.publish(Ping, '2');
    expect(count).toBe(1);
  });

  it('once() delivers exactly one event then auto-detaches', async () => {
    const { bus } = makeBus();
    let count = 0;
    bus.once(Ping, () => {
      count += 1;
    });
    await bus.publish(Ping, '1');
    await bus.publish(Ping, '2');
    expect(count).toBe(1);
  });

  it('isolates handler failures: others still run, AggregateError surfaced', async () => {
    const { bus } = makeBus();
    const ok: string[] = [];
    bus.subscribe(Ping, () => {
      ok.push('ok');
    });
    bus.subscribe(Ping, () => {
      throw new Error('boom');
    });
    await expect(bus.publish(Ping, 'x')).rejects.toThrow(AggregateError);
    expect(ok).toEqual(['ok']);
    expect(bus.metrics().failedHandlers).toBe(1);
  });

  it('respects per-subscription priority (critical first)', async () => {
    const { bus } = makeBus();
    const order: string[] = [];
    bus.subscribe(
      Ping,
      () => {
        order.push('normal');
      },
      { priority: 'normal' },
    );
    bus.subscribe(
      Ping,
      () => {
        order.push('critical');
      },
      { priority: 'critical' },
    );
    bus.subscribe(
      Ping,
      () => {
        order.push('low');
      },
      { priority: 'low' },
    );
    await bus.publish(Ping, 'x');
    expect(order).toEqual(['critical', 'normal', 'low']);
  });

  it('throws when payload validation fails', async () => {
    const Strict = { type: 'test.strict', version: 1, validate: (p: string) => p.length > 0 };
    const { bus } = makeBus();
    await expect(bus.publish(Strict, '')).rejects.toThrow(/validation/);
  });
});

describe('EventBus — wildcard', () => {
  it('wildcard subscriber receives every event type', async () => {
    const { bus } = makeBus();
    const types: string[] = [];
    bus.subscribe({ type: '*', version: 0 }, (env) => {
      types.push(env.definition.type);
    });
    await bus.publish(Ping, 'a');
    await bus.publish(Pong, { value: 1 });
    expect(types).toEqual(['test.ping', 'test.pong']);
  });
});

describe('EventBus — cancellation & metadata', () => {
  it('block middleware cancels delivery (dropped metric, no handlers run)', async () => {
    const { bus } = makeBus();
    let ran = false;
    bus.use(async (ctx: MiddlewareContext, next: NextFn) => {
      if (ctx.envelope.definition.type === 'test.ping') {
        ctx.cancelled = true;
        return;
      }
      return next();
    });
    bus.subscribe(Ping, () => {
      ran = true;
    });
    await bus.publish(Ping, 'x');
    expect(ran).toBe(false);
    expect(bus.metrics().dropped).toBe(1);
  });

  it('propagates correlation id and priority from publish options', async () => {
    const { bus } = makeBus();
    let captured: string | null = null;
    let prio = 'normal';
    bus.subscribe(Ping, (env) => {
      captured = env.metadata.correlationId;
      prio = env.metadata.priority;
    });
    await bus.publish(Ping, 'x', { correlationId: 'corr-9' as never, priority: 'high' });
    expect(captured).toBe('corr-9');
    expect(prio).toBe('high');
  });
});
