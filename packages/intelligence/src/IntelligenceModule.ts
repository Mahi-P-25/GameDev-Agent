import { createServiceToken } from '@gamedev-agent/di';
import type { StudioKernel } from '@gamedev-agent/kernel';
import { AgentRegistry } from './AgentRegistry';
import { seedDefaultAgents } from './Agents';
import { AgentRegistered } from './IntelligenceEvents';
import { AgentActivityLog, NotificationCenter, bindAgentRegistry } from './NotificationCenter';
import { PlanningEngine } from './PlanningEngine';
import { TaskEngine } from './TaskEngine';

/** DI token for the {@link AgentRegistry}. */
export const AGENT_REGISTRY_TOKEN = createServiceToken<AgentRegistry>('nova.agent-registry');

/** DI token for the {@link TaskEngine}. */
export const TASK_ENGINE_TOKEN = createServiceToken<TaskEngine>('nova.task-engine');

/** DI token for the {@link PlanningEngine}. */
export const PLANNING_ENGINE_TOKEN = createServiceToken<PlanningEngine>(
  'nova.intelligence-planning',
);

/** DI token for the {@link NotificationCenter}. */
export const NOTIFICATION_CENTER_TOKEN = createServiceToken<NotificationCenter>(
  'nova.notification-center',
);

/** DI token for the {@link AgentActivityLog}. */
export const AGENT_ACTIVITY_TOKEN = createServiceToken<AgentActivityLog>('nova.agent-activity');

/**
 * Kernel module that installs the Nova Studio Intelligence layer.
 *
 * Registering it during kernel boot makes every token in this module resolvable.
 * The module wires the Agent Registry, Task Engine, Planning Engine, Notification
 * Center, and Agent Activity log to the shared Event Bus and Logger. It seeds the
 * default specialized agent roster so plans can assign tasks immediately.
 *
 * The module depends only on the public kernel contract (bus, logger) — never on
 * the subsystems' internals. Future integrations (Claude Code, OpenCode, Git,
 * Terminal, Build) plug in by registering an {@link OperationRunner} on the Task
 * Engine and adding agents to {@link DEFAULT_AGENTS}, without changing this module.
 */
export const intelligenceModule: {
  readonly name: string;
  register(kernel: StudioKernel): void;
} = {
  name: 'nova.intelligence',
  register(kernel: StudioKernel): void {
    const logger = kernel.logger.child('intelligence');

    kernel.registerService({
      token: AGENT_REGISTRY_TOKEN,
      singleton: true,
      factory: () => {
        const registry = new AgentRegistry();
        const agents = seedDefaultAgents(registry);
        for (const agent of agents) {
          void kernel.events.publish(AgentRegistered, {
            agentId: agent.id,
            kind: agent.kind,
            name: agent.name,
            capabilities: agent.capabilities,
            timestamp: agent.registeredAt,
          });
        }
        bindAgentRegistry(registry);
        kernel.events.subscribe(AgentRegistered, (e) =>
          logger.info(`agent registered: ${e.payload.kind}`),
        );
        return registry;
      },
    });

    kernel.registerService({
      token: TASK_ENGINE_TOKEN,
      singleton: true,
      factory: () =>
        new TaskEngine({
          bus: kernel.events,
          logger: logger.child('tasks'),
        }),
    });

    kernel.registerService({
      token: PLANNING_ENGINE_TOKEN,
      singleton: true,
      factory: async () =>
        new PlanningEngine({
          registry: await kernel.services.resolve<AgentRegistry>(AGENT_REGISTRY_TOKEN),
          tasks: await kernel.services.resolve<TaskEngine>(TASK_ENGINE_TOKEN),
          bus: kernel.events,
        }),
    });

    kernel.registerService({
      token: NOTIFICATION_CENTER_TOKEN,
      singleton: true,
      factory: () =>
        new NotificationCenter({
          bus: kernel.events,
          logger: logger.child('notifications'),
        }),
    });

    kernel.registerService({
      token: AGENT_ACTIVITY_TOKEN,
      singleton: true,
      factory: () => new AgentActivityLog({ bus: kernel.events }),
    });
  },
};
