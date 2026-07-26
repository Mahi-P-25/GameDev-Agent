import type { EventBusContract } from '@gamedev-agent/events';
import type { Disposable, Timestamp, UUID } from '@gamedev-agent/shared';
import type { AgentRegistry } from './AgentRegistry';
import { PlanCreated } from './IntelligenceEvents';
import type { Agent, Operation, Task, TaskPlan, TaskPlanId } from './IntelligenceTypes';
import type { TaskEngine } from './TaskEngine';

/**
 * A single declarative step in a goal, supplied by the caller (the Director, the
 * Producer, or a future goal interface). The Planning Engine turns these into
 * concrete Tasks assigned to real agents — it does not invent steps.
 */
export interface GoalStep {
  readonly title: string;
  readonly description: string;
  /** The real operation this step executes (must map to a registered capability). */
  readonly operation: Operation;
  /** The agent kind that should host this step (e.g. `engineer`, `qa`). */
  readonly agentKind: string;
  /** Indexes (into `steps`) of steps that must succeed first. */
  readonly dependsOn?: ReadonlyArray<number>;
}

export interface PlanGoalRequest {
  /** Free-form goal/objective text (truthfully propagated to the plan). */
  readonly goal: string;
  /** Arbitrary correlation (goal id, mission id, project id). */
  readonly correlationId?: string | null;
  /** The steps that realize the goal. */
  readonly steps: ReadonlyArray<GoalStep>;
  /** Override the planning strategy (defaults to `capability-match`). */
  readonly strategy?: string;
}

export interface PlanningEngineOptions {
  readonly registry: AgentRegistry;
  readonly tasks: TaskEngine;
  readonly bus?: EventBusContract | undefined;
  readonly idGenerator?: (() => UUID) | undefined;
}

/**
 * Planning Engine — converts high-level goals into executable {@link TaskPlan}s.
 *
 * This engine is **not** an AI model. It is a deterministic translator: given a
 * goal expressed as real {@link GoalStep}s (each carrying a real {@link Operation})
 * and the roster of registered {@link Agent}s, it assigns every step to a matching
 * agent and emits a dependency-ordered plan of real {@link Task}s. The plan is
 * immutable once built; execution is delegated to the {@link TaskEngine}.
 *
 * Future integrations (Claude Code, OpenCode, Git, Terminal, Build) provide more
 * operation kinds and more specialized agents; the engine's matching logic stays
 * the same. A future `ai-strategy` can reorder/parallelize steps behind the same
 * {@link PlanGoalRequest} contract without changing callers.
 */
export class PlanningEngine implements Disposable {
  private readonly registry: AgentRegistry;
  private readonly tasks: TaskEngine;
  private readonly bus?: EventBusContract | undefined;
  private readonly idGenerator: () => UUID;
  private disposed = false;

  constructor(options: PlanningEngineOptions) {
    this.registry = options.registry;
    this.tasks = options.tasks;
    this.bus = options.bus;
    this.idGenerator = options.idGenerator ?? (() => crypto.randomUUID() as UUID);
  }

  /**
   * Build (and materialize as Tasks) a plan for the goal. Returns the immutable
   * {@link TaskPlan}. Throws if a step cannot be assigned to any registered agent.
   */
  planGoal(request: PlanGoalRequest): TaskPlan {
    if (this.disposed) {
      throw new Error('PlanningEngine is disposed');
    }
    const now = Date.now() as Timestamp;
    const planId = this.idGenerator() as TaskPlanId;
    const strategy = request.strategy ?? 'capability-match';

    const built: Task[] = [];
    request.steps.forEach((step, index) => {
      const agent = this.assignAgent(step.agentKind, step.operation.requiredCapability);
      const dependsOn = (step.dependsOn ?? []).map((upstream) => {
        const upstreamTask = built[upstream];
        if (upstreamTask === undefined) {
          throw new Error(`Goal step ${index} depends on unknown step ${upstream}`);
        }
        return upstreamTask.id;
      });
      const task = this.tasks.create({
        title: step.title,
        description: step.description,
        agentId: agent.id,
        operation: step.operation,
        planId,
        dependsOn,
        correlationId: request.correlationId ?? null,
      });
      built.push(this.tasks.plan(task.id));
    });

    const plan: TaskPlan = {
      id: planId,
      goal: request.goal,
      correlationId: request.correlationId ?? null,
      tasks: built,
      strategy,
      createdAt: now,
    };
    if (this.bus !== undefined) {
      void this.bus.publish(PlanCreated, {
        planId,
        goal: request.goal,
        taskCount: built.length,
        correlationId: request.correlationId ?? null,
        timestamp: now,
      });
    }
    return plan;
  }

  private assignAgent(kind: string, capability: string | undefined): Agent {
    const candidates = this.registry
      .list()
      .filter((a) => a.kind === kind)
      .filter((a) => capability === undefined || a.capabilities.includes(capability));
    if (candidates.length === 0) {
      const need = capability === undefined ? kind : `${kind} (capability: ${capability})`;
      throw new Error(`No registered agent can host goal step: ${need}`);
    }
    // Deterministic pick: prefer a ready agent, else the first candidate.
    const ready = candidates.find((a) => a.status === 'ready');
    const chosen = ready ?? candidates[0];
    if (chosen === undefined) {
      throw new Error('No candidate agent available');
    }
    return chosen;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
  }
}
