import { createServiceToken } from '@gamedev-agent/di';
import type { StudioKernel } from '@gamedev-agent/kernel';
import { MEMORY_MANAGER_TOKEN } from '@gamedev-agent/memory';
import type { MemoryManager } from '@gamedev-agent/memory';
import { AgentRuntime } from './AgentRuntime';

export const AGENT_RUNTIME_TOKEN = createServiceToken<AgentRuntime>('nova.agent-runtime');

export const agentRuntimeModule: {
  readonly name: string;
  register(kernel: StudioKernel): void | Promise<void>;
} = {
  name: 'nova.agent-runtime',
  async register(kernel: StudioKernel): Promise<void> {
    const memory = await kernel.services.resolve<MemoryManager>(MEMORY_MANAGER_TOKEN);

    kernel.registerService({
      token: AGENT_RUNTIME_TOKEN,
      singleton: true,
      factory: () => {
        const runtime = new AgentRuntime({
          eventBus: kernel.events,
          memory,
          logger: kernel.logger.child('agent-runtime'),
        });
        return runtime;
      },
    });
  },
};
