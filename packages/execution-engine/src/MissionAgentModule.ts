import { createServiceToken } from '@gamedev-agent/di';
import type { KernelModule, StudioKernel } from '@gamedev-agent/kernel';
import { MODEL_PROVIDERS_SERVICE_TOKEN } from '@gamedev-agent/model-providers';
import { TOOL_RUNTIME_TOKEN } from '@gamedev-agent/tool-runtime';
import { MissionAgent } from './MissionAgent';

export const MISSION_AGENT_TOKEN = createServiceToken<MissionAgent>('nova.mission-agent');

export const missionAgentModule: KernelModule = {
  name: 'nova.mission-agent',
  async register(kernel: StudioKernel): Promise<void> {
    const logger = kernel.logger.child('mission-agent');
    const eventBus = kernel.events;

    kernel.registerService({
      token: MISSION_AGENT_TOKEN,
      singleton: true,
      factory: async () => {
        const [toolManager, modelProviders] = await Promise.all([
          kernel.services.resolve(TOOL_RUNTIME_TOKEN),
          kernel.services.resolve(MODEL_PROVIDERS_SERVICE_TOKEN),
        ]);

        return new MissionAgent({
          toolManager,
          modelProviders,
          eventBus,
          logger,
        });
      },
    });
  },
};
