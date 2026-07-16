import { describe, expect, it } from 'vitest';
import {
  createBlockMiddleware,
  createFilterMiddleware,
  createLoggingMiddleware,
  createTransformMiddleware,
  matchDefinition,
} from './middleware';
import { makeBus } from './test_helpers';
import type { EventDefinition, MiddlewareContext } from './types';

const A = def<number>('test.a');
function def<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

describe('middleware factory helpers', () => {
  it('matchDefinition matches by type', () => {
    const env = {
      definition: { type: 'test.a', version: 1 },
    } as unknown as MiddlewareContext['envelope'];
    expect(matchDefinition(env, A)).toBe(true);
    expect(matchDefinition(env, def<number>('test.b'))).toBe(false);
  });

  it('createFilterMiddleware drops non-matching; next not called', async () => {
    const { bus } = makeBus();
    let ran = false;
    bus.use(createFilterMiddleware((env) => (env.payload as number) > 5));
    bus.subscribe(A, () => {
      ran = true;
    });
    await bus.publish(A, 3);
    expect(ran).toBe(false);
    await bus.publish(A, 9);
    expect(ran).toBe(true);
    expect(bus.metrics().dropped).toBe(1);
  });

  it('createBlockMiddleware blocks matching types', async () => {
    const { bus } = makeBus();
    let ran = false;
    bus.use(createBlockMiddleware((env) => matchDefinition(env, A)));
    bus.subscribe(A, () => {
      ran = true;
    });
    await bus.publish(A, 1);
    expect(ran).toBe(false);
    expect(bus.metrics().dropped).toBe(1);
  });

  it('createTransformMiddleware mutates payload', async () => {
    const { bus } = makeBus();
    bus.use(
      createTransformMiddleware((env) => ({
        ...env,
        payload: (env.payload as number) * 2,
      })),
    );
    let got = 0;
    bus.subscribe(A, (env) => {
      got = env.payload;
    });
    await bus.publish(A, 5);
    expect(got).toBe(10);
  });

  it('createLoggingMiddleware observes envelope without altering flow', async () => {
    const { bus } = makeBus();
    const log = createLoggingMiddleware((env) => env.definition.type);
    bus.use(log);
    let ran = false;
    bus.subscribe(A, () => {
      ran = true;
    });
    await bus.publish(A, 1);
    expect(ran).toBe(true);
  });
});

describe('middleware composition', () => {
  it('composes multiple middlewares in registration order', async () => {
    const { bus } = makeBus();
    const order: string[] = [];
    bus.use((_ctx, next) => {
      order.push('m1');
      return next();
    });
    bus.use((_ctx, next) => {
      order.push('m2');
      return next();
    });
    bus.subscribe(A, () => {
      order.push('handler');
    });
    await bus.publish(A, 1);
    expect(order).toEqual(['m1', 'm2', 'handler']);
  });
});
