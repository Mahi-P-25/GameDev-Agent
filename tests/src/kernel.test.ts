import { Kernel, createServiceToken } from '@gamedev-agent/kernel';
import { KERNEL_TOKEN, LOGGER_TOKEN } from '@gamedev-agent/kernel';
import type { KernelModule } from '@gamedev-agent/kernel';
import { describe, expect, it } from 'vitest';

describe('Kernel', () => {
  it('boots and shuts down with default in-kernel infrastructure', async () => {
    const kernel = new Kernel({ namespace: 'test', logSinks: [] });
    expect(kernel.state).toBe('idle');

    await kernel.boot();
    expect(kernel.state).toBe('running');
    expect(kernel.namespace).toBe('test');

    const self = await kernel.services.resolve(KERNEL_TOKEN);
    expect(self).toBe(kernel);
    const logger = await kernel.services.resolve(LOGGER_TOKEN);
    expect(logger).toBe(kernel.logger);

    await kernel.shutdown();
    expect(kernel.state).toBe('stopped');
  });

  it('is idempotent when booting an already-running kernel', async () => {
    const kernel = new Kernel({ logSinks: [] });
    await kernel.boot();
    await expect(kernel.boot()).resolves.toBeUndefined();
    await kernel.shutdown();
  });

  it('runs module register then boot in order, and shutdown in reverse', async () => {
    const order: string[] = [];
    const make = (name: string): KernelModule => ({
      name,
      register: () => {
        order.push(`register:${name}`);
      },
      boot: () => {
        order.push(`boot:${name}`);
      },
      shutdown: () => {
        order.push(`shutdown:${name}`);
      },
    });

    const kernel = new Kernel({ logSinks: [], modules: [make('a'), make('b')] });
    await kernel.boot();
    await kernel.shutdown();

    expect(order).toEqual([
      'register:a',
      'register:b',
      'boot:a',
      'boot:b',
      'shutdown:b',
      'shutdown:a',
    ]);
  });

  it('detects circular service dependencies', async () => {
    const token = createServiceToken<number>('cyclic');
    const kernel = new Kernel({ logSinks: [] });
    kernel.registerService({
      token,
      singleton: true,
      factory: (container) => container.resolve(token),
    });
    await kernel.boot();
    await expect(kernel.services.resolve(token)).rejects.toThrow(/Circular dependency/);
    await kernel.shutdown();
  });
});
