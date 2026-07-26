import { createServiceToken } from '@gamedev-agent/di';
import type { StudioKernel } from '@gamedev-agent/kernel';
import { InMemoryMemoryStore } from './InMemoryMemoryStore';
import { MemoryManager } from './MemoryManager';

export const MEMORY_MANAGER_TOKEN = createServiceToken<MemoryManager>('nova.memory-manager');
export const MEMORY_STORE_TOKEN = createServiceToken<InMemoryMemoryStore>('nova.memory-store');

export const memoryModule: {
  readonly name: string;
  register(kernel: StudioKernel): void | Promise<void>;
} = {
  name: 'nova.memory',
  async register(kernel: StudioKernel): Promise<void> {
    const store = new InMemoryMemoryStore();

    kernel.registerService({
      token: MEMORY_STORE_TOKEN,
      singleton: true,
      factory: () => store,
    });

    kernel.registerService({
      token: MEMORY_MANAGER_TOKEN,
      singleton: true,
      factory: () => {
        const manager = new MemoryManager({
          eventBus: kernel.events,
          store,
          logger: kernel.logger.child('memory'),
        });
        manager.start().catch((err) => {
          kernel.logger.error('memory.manager.start.failed', { error: String(err) });
        });
        return manager;
      },
    });
  },
};
