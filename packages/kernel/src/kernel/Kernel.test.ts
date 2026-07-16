import { createServiceToken } from '@gamedev-agent/di';
import { InMemoryEventBus } from '@gamedev-agent/events';
import type { LogEntry, LogSink } from '@gamedev-agent/logging';
import { describe, expect, it } from 'vitest';
import {
  CONFIG_TOKEN,
  EVENT_BUS_TOKEN,
  KERNEL_TOKEN,
  Kernel,
  LOGGER_TOKEN,
  SERVICES_TOKEN,
} from '../index';
import type { KernelModule } from '../kernel/types';
import { KERNEL_EVENTS, LIFECYCLE_EVENTS } from '../lifecycle/events';
import { LIFECYCLE_STAGES } from '../lifecycle/types';

/** A sink that captures entries, for asserting on kernel output. */
function capturingSink() {
  const entries: LogEntry[] = [];
  const sink: LogSink = {
    name: 'capture',
    write: (entry) => {
      entries.push(entry);
    },
  };
  return { entries, sink };
}

describe('Kernel lifecycle', () => {
  it('boots through every stage and reaches running', async () => {
    const kernel = new Kernel({ logSinks: [] });
    expect(kernel.state).toBe('idle');

    await kernel.boot();

    expect(kernel.state).toBe('running');
    expect(kernel.lifecycle.current).toBe('running');
    expect(kernel.lifecycle.records.map((r) => r.stage)).toEqual(LIFECYCLE_STAGES.slice(0, 8));
  });

  it('emits lifecycle:stage-enter events in canonical order', async () => {
    const bus = new InMemoryEventBus('test');
    const kernel = new Kernel({ eventBus: bus, logSinks: [] });
    const stages: string[] = [];
    await bus.on(LIFECYCLE_EVENTS.stageEnter, (e) => {
      stages.push((e.payload as { stage: string }).stage);
    });

    await kernel.boot();

    expect(stages).toEqual(LIFECYCLE_STAGES.slice(0, 8));
    await kernel.shutdown();
  });

  it('emits kernel:booted and kernel:ready milestones', async () => {
    const bus = new InMemoryEventBus('test');
    const kernel = new Kernel({ eventBus: bus, logSinks: [] });
    const events: string[] = [];
    await bus.on(KERNEL_EVENTS.ready, () => {
      events.push('ready');
    });
    await bus.on(KERNEL_EVENTS.booted, () => {
      events.push('booted');
    });

    await kernel.boot();
    await kernel.shutdown();

    expect(events).toEqual(['ready', 'booted']);
  });

  it('runs module register (service-registry) then boot (event-bus), shutdown reverse (halt)', async () => {
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

  it('registers core services as resolvable singletons', async () => {
    const kernel = new Kernel({ logSinks: [] });
    await kernel.boot();

    expect(await kernel.services.resolve(KERNEL_TOKEN)).toBe(kernel);
    expect(await kernel.services.resolve(LOGGER_TOKEN)).toBe(kernel.logger);
    expect(await kernel.services.resolve(EVENT_BUS_TOKEN)).toBe(kernel.events);
    expect(await kernel.services.resolve(CONFIG_TOKEN)).toBe(kernel.config);
    expect(await kernel.services.resolve(SERVICES_TOKEN)).toBe(kernel.services);

    await kernel.shutdown();
  });

  it('lets a module register a service that is then resolvable (dependency initialization)', async () => {
    const TOKEN = createServiceToken<{ id: number }>('demo');
    const module: KernelModule = {
      name: 'demo',
      register: (k) => {
        k.registerService({ token: TOKEN, singleton: true, factory: () => ({ id: 42 }) });
      },
    };
    const kernel = new Kernel({ logSinks: [], modules: [module] });
    await kernel.boot();

    const demo = await kernel.services.resolve(TOKEN);
    expect(demo.id).toBe(42);

    await kernel.shutdown();
  });

  it('supports module-contributed lifecycle hooks at later stages', async () => {
    const readyMarkers: string[] = [];
    const module: KernelModule = {
      name: 'hooked',
      register: (k) => {
        // Schedule work for the 'ready' stage from within 'service-registry'.
        k.lifecycle.on('ready', () => {
          readyMarkers.push('ready-hook');
        });
      },
    };
    const kernel = new Kernel({ logSinks: [], modules: [module] });
    await kernel.boot();
    expect(readyMarkers).toEqual(['ready-hook']);
    await kernel.shutdown();
  });

  it('disposes singleton services on shutdown (graceful termination)', async () => {
    const disposed: string[] = [];
    const TOKEN = createServiceToken<{ dispose: () => void }>('disposable');
    const module: KernelModule = {
      name: 'disposable-mod',
      register: (k) => {
        k.registerService({
          token: TOKEN,
          singleton: true,
          factory: () => ({ dispose: () => disposed.push('disposed') }),
        });
      },
    };
    const kernel = new Kernel({ logSinks: [], modules: [module] });
    await kernel.boot();
    await kernel.services.resolve(TOKEN);

    await kernel.shutdown();
    expect(disposed).toEqual(['disposed']);
    expect(kernel.state).toBe('stopped');
    expect(kernel.lifecycle.records.map((r) => r.stage)).toContain('halt');
  });

  it('fails the boot and surfaces a fault event when a module boot throws', async () => {
    const bus = new InMemoryEventBus('test');
    const faults: Array<{ stage: string; error: string }> = [];
    await bus.on(LIFECYCLE_EVENTS.fault, (e) => {
      const p = e.payload as { stage: string; error: string };
      faults.push({ stage: p.stage, error: p.error });
    });

    const failingModule: KernelModule = {
      name: 'boom',
      boot: () => {
        throw new Error('module-boot-failed');
      },
    };
    const kernel = new Kernel({ eventBus: bus, logSinks: [], modules: [failingModule] });

    await expect(kernel.boot()).rejects.toThrow('module-boot-failed');
    expect(kernel.state).toBe('failed');
    expect(faults).toHaveLength(1);
    expect(faults[0]?.stage).toBe('event-bus');

    // The failed kernel can still be torn down cleanly.
    await kernel.shutdown();
    expect(kernel.state).toBe('stopped');
  });

  it('is idempotent when booting an already-running kernel', async () => {
    const kernel = new Kernel({ logSinks: [] });
    await kernel.boot();
    await expect(kernel.boot()).resolves.toBeUndefined();
    await kernel.shutdown();
  });

  it('is idempotent when shutting down an already-stopped kernel', async () => {
    const kernel = new Kernel({ logSinks: [] });
    await kernel.boot();
    await kernel.shutdown();
    await expect(kernel.shutdown()).resolves.toBeUndefined();
  });

  it('dispose() is an alias for shutdown()', async () => {
    const kernel = new Kernel({ logSinks: [] });
    await kernel.boot();
    await kernel.dispose();
    expect(kernel.state).toBe('stopped');
  });

  it('detects circular service dependencies', async () => {
    const token = createServiceToken<number>('cyclic');
    const kernel = new Kernel({ logSinks: [] });
    kernel.registerService({ token, singleton: true, factory: (c) => c.resolve(token) });
    await kernel.boot();
    await expect(kernel.services.resolve(token)).rejects.toThrow(/Circular dependency/);
    await kernel.shutdown();
  });

  it('warns when teardown exceeds the configured shutdown timeout', async () => {
    const { entries, sink } = capturingSink();
    const SLOW = createServiceToken<{ dispose: () => Promise<void> }>('slow');
    const module: KernelModule = {
      name: 'slow-mod',
      register: (k) => {
        k.registerService({
          token: SLOW,
          singleton: true,
          factory: () => ({
            dispose: () => new Promise<void>((resolve) => setTimeout(resolve, 20)),
          }),
        });
      },
    };
    const kernel = new Kernel({
      logSinks: [sink],
      modules: [module],
      configSources: [
        {
          name: 'inline',
          has: (p) => p === 'kernel.shutdownTimeoutMs',
          load: <T>(_path: string): Promise<T> => Promise.resolve(5) as Promise<T>,
        },
      ],
    });
    await kernel.boot();
    await kernel.services.resolve(SLOW);
    await kernel.shutdown();

    expect(entries.some((e) => e.level === 'warn' && e.message === 'kernel.shutdown.slow')).toBe(
      true,
    );
  });
});
