import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import type { Disposable, Timestamp, UUID } from '@gamedev-agent/shared';
import {
  TaskBlocked,
  TaskCanceled,
  TaskFailed,
  TaskProgress,
  TaskRunning,
  TaskSubmitted,
  TaskSucceeded,
} from './IntelligenceEvents';
import type {
  AgentId,
  Operation,
  OperationId,
  Task,
  TaskId,
  TaskPlanId,
} from './IntelligenceTypes';
import { TASK_TERMINAL_STATES } from './IntelligenceTypes';

/**
 * Operation Runner — the real-execution seam.
 *
 * The Intelligence layer never fabricates work. When a Task is due to run, the
 * Task Engine asks a registered {@link OperationRunner} to perform the task's real
 * operation. The runner is supplied by an integration (today the Studio's
 * workflow runner; future: Git, Terminal, Build, Claude Code, OpenCode). The
 * runner reports back through the callbacks, which is the *only* way a Task
 * advances state. There is no internal "thinking" step.
 */
export interface OperationRunner {
  /** Stable id, e.g. `nova.workflow-runner`. */
  readonly id: OperationId;
  /** The operation kinds this runner can execute. */
  readonly kinds: ReadonlyArray<Operation['kind']>;
  /**
   * Execute a real operation. Must invoke exactly one terminal callback
   * (`onSucceeded` or `onFailed`) and may invoke `onProgress` any number of
   * times. Implementations must be truthful: progress and failure reasons come
   * from the real underlying tool, never synthesized.
   */
  run(input: {
    readonly operation: Operation;
    readonly taskId: TaskId;
    readonly agentId: AgentId;
    readonly correlationId: string | null;
    onProgress(progress: number): void;
    onSucceeded(): void;
    onFailed(reason: string): void;
  }): Disposable;
}

export interface TaskEngineOptions {
  readonly bus: EventBusContract;
  readonly logger?: Logger | undefined;
  readonly idGenerator?: (() => UUID) | undefined;
  /** The real runner that performs operations. Must be set before `run` is called. */
  readonly runner?: OperationRunner | undefined;
}

/**
 * Task Engine — represents and tracks long-running studio work.
 *
 * Responsibilities:
 *  - Create {@link Task}s from a real {@link Operation} hosted by a real agent.
 *  - Gate execution on dependencies (a Task blocks until its `dependsOn` tasks
 *    have *succeeded*).
 *  - Drive the real operation via the supplied {@link OperationRunner} and advance
 *    the Task only from the runner's truthful callbacks.
 *  - Emit truthful `task.*` and `agent.status-changed` events.
 *
 * The engine owns no domain logic about *how* to decompose goals — that is the
 * Planning Engine's job. The engine only executes and observes.
 */
export class TaskEngine implements Disposable {
  private readonly tasks = new Map<string, Task>();
  private readonly bus: EventBusContract;
  private readonly logger?: Logger | undefined;
  private readonly idGenerator: () => UUID;
  private readonly runner: OperationRunner | null;
  private disposed = false;

  constructor(options: TaskEngineOptions) {
    this.bus = options.bus;
    this.logger = options.logger;
    this.idGenerator = options.idGenerator ?? (() => crypto.randomUUID() as UUID);
    this.runner = options.runner ?? null;
  }

  list(): ReadonlyArray<Task> {
    return [...this.tasks.values()];
  }

  find(id: TaskId): Task | undefined {
    return this.tasks.get(String(id));
  }

  /** Create a Task for a real operation hosted by a real agent. */
  create(input: {
    readonly title: string;
    readonly description: string;
    readonly agentId: AgentId;
    readonly operation: Operation;
    readonly planId?: TaskPlanId | null;
    readonly dependsOn?: ReadonlyArray<TaskId>;
    readonly correlationId?: string | null;
  }): Task {
    if (this.disposed) {
      throw new Error('TaskEngine is disposed');
    }
    const now = Date.now() as Timestamp;
    const task: Task = {
      id: this.idGenerator() as TaskId,
      planId: input.planId ?? null,
      title: input.title,
      description: input.description,
      state: 'submitted',
      agentId: input.agentId,
      operation: input.operation,
      dependsOn: [...(input.dependsOn ?? [])],
      progress: 0,
      failureReason: null,
      cancellationReason: null,
      correlationId: input.correlationId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(String(task.id), task);
    void this.bus.publish(TaskSubmitted, {
      taskId: task.id,
      agentId: task.agentId,
      operation: task.operation,
      correlationId: task.correlationId,
      timestamp: now,
    });
    return task;
  }

  /** Whether the given task's dependencies have all succeeded. */
  private dependenciesMet(task: Task): boolean {
    return task.dependsOn.every((dep) => {
      const upstream = this.tasks.get(String(dep));
      return upstream !== undefined && upstream.state === 'succeeded';
    });
  }

  /**
   * Mark a task `planned` (assigned within a plan). Does not execute anything.
   */
  plan(taskId: TaskId): Task {
    const task = this.require(taskId);
    return this.patch(task, { state: 'planned' });
  }

  /**
   * Run a task if its dependencies are met and a runner is configured. Returns
   * `true` if execution was started. Blocks truthfully (emits `task.blocked`)
   * when dependencies are unmet.
   */
  async run(taskId: TaskId): Promise<boolean> {
    const task = this.require(taskId);
    if (this.runner === null) {
      this.logger?.warn('TaskEngine.run: no operation runner configured', {
        taskId: String(taskId),
      });
      return false;
    }
    if (TASK_TERMINAL_STATES.includes(task.state)) {
      return false;
    }
    if (!this.dependenciesMet(task)) {
      const blocked = this.patch(task, { state: 'blocked' });
      void this.bus.publish(TaskBlocked, {
        taskId: blocked.id,
        agentId: blocked.agentId,
        blockedBy: blocked.dependsOn,
        timestamp: blocked.updatedAt,
      });
      return false;
    }
    const running = this.patch(task, { state: 'running' });
    void this.bus.publish(TaskRunning, {
      taskId: running.id,
      agentId: running.agentId,
      progress: running.progress,
      timestamp: running.updatedAt,
    });
    const subscription = this.runner.run({
      operation: running.operation,
      taskId: running.id,
      agentId: running.agentId,
      correlationId: running.correlationId,
      onProgress: (progress: number) => this.reportProgress(running.id, progress),
      onSucceeded: () => this.succeed(running.id),
      onFailed: (reason: string) => this.fail(running.id, reason),
    });
    void subscription;
    return true;
  }

  /** Report truthful progress from the real runner. */
  private reportProgress(taskId: TaskId, progress: number): void {
    const task = this.tasks.get(String(taskId));
    if (task === undefined || TASK_TERMINAL_STATES.includes(task.state)) {
      return;
    }
    const clamped = Math.max(0, Math.min(100, Math.round(progress)));
    const updated = this.patch(task, { progress: clamped });
    void this.bus.publish(TaskProgress, {
      taskId: updated.id,
      agentId: updated.agentId,
      progress: clamped,
      timestamp: updated.updatedAt,
    });
  }

  private succeed(taskId: TaskId): void {
    const task = this.require(taskId);
    const updated = this.patch(task, { state: 'succeeded', progress: 100 });
    void this.bus.publish(TaskSucceeded, {
      taskId: updated.id,
      agentId: updated.agentId,
      correlationId: updated.correlationId,
      timestamp: updated.updatedAt,
    });
  }

  private fail(taskId: TaskId, reason: string): void {
    const task = this.require(taskId);
    const updated = this.patch(task, {
      state: 'failed',
      progress: task.progress,
      failureReason: reason,
    });
    void this.bus.publish(TaskFailed, {
      taskId: updated.id,
      agentId: updated.agentId,
      reason,
      correlationId: updated.correlationId,
      timestamp: updated.updatedAt,
    });
  }

  /** Cancel a task with a real reason. Terminal. */
  cancel(taskId: TaskId, reason: string): Task {
    const task = this.require(taskId);
    if (TASK_TERMINAL_STATES.includes(task.state)) {
      return task;
    }
    const updated = this.patch(task, {
      state: 'canceled',
      cancellationReason: reason,
    });
    void this.bus.publish(TaskCanceled, {
      taskId: updated.id,
      agentId: updated.agentId,
      reason,
      timestamp: updated.updatedAt,
    });
    return updated;
  }

  private require(id: TaskId): Task {
    const task = this.tasks.get(String(id));
    if (task === undefined) {
      throw new Error(`Task not found: ${String(id)}`);
    }
    return task;
  }

  private patch(task: Task, changes: Partial<Task>): Task {
    const updated: Task = { ...task, ...changes, updatedAt: Date.now() as Timestamp };
    this.tasks.set(String(task.id), updated);
    return updated;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.tasks.clear();
  }
}
