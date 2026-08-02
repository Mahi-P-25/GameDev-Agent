import type { AgentRuntime } from '@gamedev-agent/agent-runtime';
import { AGENT_RUNTIME_TOKEN } from '@gamedev-agent/agent-runtime';
import { createServiceToken } from '@gamedev-agent/di';
import type { StudioKernel } from '@gamedev-agent/kernel';
import { WORKFLOW_EXECUTOR_TOKEN } from '@gamedev-agent/workflow';
import { AgentTaskExecutor } from './AgentTaskExecutor';
import { MissionOrchestrator } from './MissionOrchestrator';
import { createSpecialistDescriptors } from './agents';

export const AGENT_TASK_EXECUTOR_TOKEN = createServiceToken<AgentTaskExecutor>(
  'nova.agent-task-executor',
);
export const MISSION_ORCHESTRATOR_TOKEN = createServiceToken<MissionOrchestrator>(
  'nova.mission-orchestrator',
);

/**
 * Registers the six specialist types into the existing agent runtime, then
 * exposes the task bridge and orchestrator behind DI tokens. Ownership split
 * per report §7.1: the runtime keeps registry/lifecycle/messaging; this module
 * only contributes specialist agents + the orchestration seam.
 */
export const agentsModule: {
  readonly name: string;
  register(kernel: StudioKernel): void | Promise<void>;
} = {
  name: 'nova.agents',
  async register(kernel: StudioKernel): Promise<void> {
    const runtime = await kernel.services.resolve<AgentRuntime>(AGENT_RUNTIME_TOKEN);
    for (const descriptor of createSpecialistDescriptors()) {
      await runtime.registerType(descriptor);
    }

    kernel.registerService({
      token: AGENT_TASK_EXECUTOR_TOKEN,
      singleton: true,
      factory: async () => {
        const fallback = kernel.services.has(WORKFLOW_EXECUTOR_TOKEN)
          ? await kernel.services.resolve(WORKFLOW_EXECUTOR_TOKEN)
          : undefined;
        return new AgentTaskExecutor({
          bus: kernel.events,
          logger: kernel.logger.child('agent-task-executor'),
          ...(fallback !== undefined ? { fallback } : {}),
        });
      },
    });

    kernel.registerService({
      token: MISSION_ORCHESTRATOR_TOKEN,
      singleton: true,
      factory: async () => {
        const executor =
          await kernel.services.resolve<AgentTaskExecutor>(AGENT_TASK_EXECUTOR_TOKEN);
        return new MissionOrchestrator({
          bus: kernel.events,
          executor,
          logger: kernel.logger.child('mission-orchestrator'),
        });
      },
    });
  },
};
