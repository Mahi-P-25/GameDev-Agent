import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import type { Disposable } from '@gamedev-agent/shared';
import { AgentRegistry } from './AgentRegistry';
import { seedDefaultAgents } from './Agents';
import { AgentRegistered } from './IntelligenceEvents';
import type {
  Agent,
  AgentActivity,
  AgentId,
  Notification,
  Task,
  TaskId,
  TaskPlan,
} from './IntelligenceTypes';
import { AgentActivityLog, NotificationCenter } from './NotificationCenter';
import { PlanningEngine } from './PlanningEngine';
import type { PlanGoalRequest } from './PlanningEngine';
import { TaskEngine } from './TaskEngine';
import type { OperationRunner } from './TaskEngine';

/**
 * Intelligence — the composed Studio Intelligence layer.
 *
 * This is the single object an application resolves to drive long-running studio
 * work behind Nova. It composes the {@link AgentRegistry}, {@link TaskEngine},
 * {@link PlanningEngine}, {@link NotificationCenter}, and {@link AgentActivityLog}
 * over the shared Event Bus. The UI never sees these internals; it observes the
 * truthful notification / activity streams.
 *
 * Everything here maps to a real operation. To actually execute tasks, supply an
 * {@link OperationRunner} (the Studio's workflow runner today; Git / Terminal /
 * Build / Claude Code / OpenCode integrations later). Until a runner is attached,
 * tasks can be created and planned but will not run — the engine never fakes it.
 */
export interface IntelligenceOptions {
  readonly bus: EventBusContract;
  readonly logger?: Logger | undefined;
  /** The real runner that performs operations. Optional until execution is needed. */
  readonly runner?: OperationRunner | undefined;
}

export class Intelligence implements Disposable {
  readonly agents: AgentRegistry;
  readonly tasks: TaskEngine;
  readonly planning: PlanningEngine;
  readonly notifications: NotificationCenter;
  readonly activity: AgentActivityLog;
  private disposed = false;

  constructor(options: IntelligenceOptions) {
    this.agents = new AgentRegistry();
    const seeded = seedDefaultAgents(this.agents);
    for (const agent of seeded) {
      void options.bus.publish(AgentRegistered, {
        agentId: agent.id,
        kind: agent.kind,
        name: agent.name,
        capabilities: agent.capabilities,
        timestamp: agent.registeredAt,
      });
    }
    this.tasks = new TaskEngine({
      bus: options.bus,
      logger: options.logger?.child('tasks'),
      runner: options.runner,
    });
    this.planning = new PlanningEngine({
      registry: this.agents,
      tasks: this.tasks,
      bus: options.bus,
    });
    this.notifications = new NotificationCenter({
      bus: options.bus,
      logger: options.logger?.child('notifications'),
    });
    this.activity = new AgentActivityLog({ bus: options.bus });
  }

  /** Register a specialized agent (a real host for operations). */
  registerAgent(input: {
    readonly kind: string;
    readonly name: string;
    readonly description: string;
    readonly capabilities: ReadonlyArray<string>;
  }): Agent {
    return this.agents.register(input);
  }

  /** Turn a goal into an executable, agent-assigned plan. */
  planGoal(request: PlanGoalRequest): TaskPlan {
    return this.planning.planGoal(request);
  }

  /** Run a single task if its dependencies are met (requires a runner). */
  runTask(taskId: TaskId): Promise<boolean> {
    return this.tasks.run(taskId);
  }

  /** Most recent truthful notifications (newest first). */
  listNotifications(limit?: number): ReadonlyArray<Notification> {
    return this.notifications.list(limit);
  }

  /** Most recent truthful agent activity (newest first). */
  listActivity(limit?: number): ReadonlyArray<AgentActivity> {
    return this.activity.list(limit);
  }

  /** All live tasks. */
  listTasks(): ReadonlyArray<Task> {
    return this.tasks.list();
  }

  /** All registered agents. */
  listAgents(): ReadonlyArray<Agent> {
    return this.agents.list();
  }

  cancelTask(taskId: TaskId, reason: string): Task {
    return this.tasks.cancel(taskId, reason);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.activity.dispose();
    this.notifications.dispose();
    this.tasks.dispose();
    this.agents.dispose();
  }
}

/** Re-export the runner contract so integrations can implement it from one place. */
export type { OperationRunner, AgentId };
