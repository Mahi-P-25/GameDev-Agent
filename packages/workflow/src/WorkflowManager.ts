import type { EventBusContract } from '@gamedev-agent/events';
import type { Clock, IdGenerator } from '@gamedev-agent/events';
import { SystemClock, UuidGenerator } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { Disposable } from '@gamedev-agent/shared';
import { Workflow } from './Workflow';
import type {
  StepExecutor,
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowExecutionId,
  WorkflowId,
  WorkflowRequest,
  WorkflowSource,
  WorkflowStepId,
} from './WorkflowDefinition';
import {
  WorkflowNotFoundError,
  WorkflowStateError,
  WorkflowTerminalError,
  WorkflowValidationError,
} from './WorkflowErrors';
import {
  WorkflowCancelled,
  WorkflowCompleted,
  WorkflowCreated,
  WorkflowFailed,
  WorkflowPaused,
  WorkflowPlanned,
  WorkflowRegistered,
  WorkflowResumed,
  WorkflowStarted,
  WorkflowStepFailed,
  WorkflowStepRetried,
  WorkflowStepSkipped,
  WorkflowStepStarted,
  WorkflowStepSucceeded,
  WorkflowUnregistered,
} from './WorkflowEvents';
import {
  WorkflowExecutionFactory,
  cancelledStepRecord,
  failedRecord,
  isStepTerminal,
  runningRecord,
  skippedRecord,
  succeededRecord,
} from './WorkflowExecution';
import { WorkflowRegistry } from './WorkflowRegistry';
import { canTransition, isTerminal } from './WorkflowState';

/**
 * Orchestrates the Workflow lifecycle and is the single point of integration
 * between the Workflow domain (planner + registry + execution factory +
 * state machine) and Nova's shared infrastructure (the Event Bus, Logger, and
 * the future StepExecutor).
 *
 * Responsibilities:
 *  - Register workflow definitions through the {@link WorkflowRegistry}.
 *  - Accept approved Mission Trees / sources and turn them into planned runs.
 *  - Drive execution in dependency order (sequential today; grouped for future
 *    parallelism), delegating each step to an injected {@link StepExecutor}.
 *  - Support `pause` / `resume` / `cancel` / `retry` control signals at run and
 *    step granularity.
 *  - Guard every transition against {@link canTransition}, throwing
 *    {@link WorkflowStateError}/{@link WorkflowTerminalError} on an illegal or
 *    terminal move.
 *  - Publish a strongly-typed event for every state change.
 *
 * The manager depends only on abstractions (`EventBusContract`, `Logger`,
 * `StepExecutor`) — never on the Producer, Planner, Roles, or Execution Engine
 * packages — and owns no singleton; callers inject the bus/logger/executor (and
 * can supply test doubles). It is `Disposable` for kernel-scoped teardown.
 */
export interface WorkflowManagerOptions {
  readonly eventBus: EventBusContract;
  readonly logger?: Logger;
  /** Performs the real work of a step. Optional: when absent, steps are driven
   *  explicitly via `succeedStep`/`failStep` (used by tests and by a future
   *  Execution Engine reporting results back). */
  readonly executor?: StepExecutor;
  readonly registry?: WorkflowRegistry;
  readonly planner?: Workflow;
  readonly executionFactory?: WorkflowExecutionFactory;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
}

export class WorkflowManager implements Disposable {
  private readonly bus: EventBusContract;
  private readonly logger: Logger;
  private executor: StepExecutor | undefined;
  private readonly registry: WorkflowRegistry;
  private readonly planner: Workflow;
  private readonly factory: WorkflowExecutionFactory;
  private disposed = false;

  constructor(options: WorkflowManagerOptions) {
    this.bus = options.eventBus;
    this.logger = options.logger ?? new RootLogger('nova.workflow', [new ConsoleLogSink()]);
    this.executor = options.executor;
    this.registry = options.registry ?? new WorkflowRegistry();
    const clock = options.clock ?? SystemClock;
    const idGenerator = options.idGenerator ?? UuidGenerator;
    this.planner = options.planner ?? new Workflow({ clock });
    this.factory = options.executionFactory ?? new WorkflowExecutionFactory({ clock, idGenerator });
  }

  /**
   * Attach a step executor after construction. The Workflow Engine is
   * executor-agnostic and may be wired once the executor's own dependencies
   * (tools, project manager) are registered — e.g. by a later-booted kernel
   * module. A run started before the executor attaches sits in `running` and is
   * auto-driven once it is; a run started after attaches immediately.
   */
  setExecutor(executor: StepExecutor): void {
    this.executor = executor;
  }

  // --- workflow definitions --------------------------------------------------

  /** Register a workflow definition. Emits `workflow.registered`. */
  async register(definition: WorkflowDefinition): Promise<void> {
    this.registry.register(definition);
    this.logger.info('workflow.registered', { id: definition.id, name: definition.name });
    await this.bus.publish(WorkflowRegistered, {
      workflowId: definition.id,
      name: definition.name,
      version: definition.version,
      timestamp: this.now(),
    });
  }

  /** Remove a workflow definition. Emits `workflow.unregistered`. */
  async unregister(id: string): Promise<void> {
    this.registry.unregister(id);
    await this.bus.publish(WorkflowUnregistered, {
      workflowId: id as WorkflowId,
      timestamp: this.now(),
    });
  }

  /** Look up a registered definition. */
  getDefinition(id: string): WorkflowDefinition {
    return this.registry.get(id);
  }

  /** List all registered definitions. */
  listDefinitions(): ReadonlyArray<WorkflowDefinition> {
    return this.registry.definitions();
  }

  // --- create + plan ---------------------------------------------------------

  /**
   * Create a workflow execution from a registered definition. Validates, plans,
   * moves `created → planned`, and emits `workflow.created` then
   * `workflow.planned`. Throws {@link WorkflowNotFoundError} when the definition
   * is unknown.
   */
  async create(request: WorkflowRequest): Promise<WorkflowExecution> {
    const definition = this.registry.get(request.workflowId);
    const plan = this.planner.plan(definition, request.mode, request.maxAttempts);
    const execution = this.factory.create(
      definition,
      plan,
      request.projectId,
      request.missionId ?? null,
      request.metadata,
    );
    const planned = this.factory.toPlanned(execution);
    this.registry.add(planned);
    this.logger.info('workflow.created', {
      id: planned.id,
      workflowId: definition.id,
      projectId: request.projectId,
    });
    await this.bus.publish(WorkflowCreated, {
      executionId: planned.id,
      workflowId: definition.id,
      projectId: request.projectId,
      missionId: request.missionId ?? null,
      timestamp: this.now(),
    });
    await this.bus.publish(WorkflowPlanned, {
      executionId: planned.id,
      workflowId: definition.id,
      mode: plan.mode,
      stepCount: plan.order.length,
      timestamp: this.now(),
    });
    return planned;
  }

  /** Plan from an arbitrary {@link WorkflowSource} (e.g. an approved Mission Tree). */
  async createFromSource(source: WorkflowSource, maxAttempts?: number): Promise<WorkflowExecution> {
    const plan = this.planner.planFromSource(source, maxAttempts);
    // A source is not a registered definition, so synthesise a throwaway
    // definition-shaped record just for id/name bookkeeping.
    const definition: WorkflowDefinition = {
      id: source.sourceId as WorkflowDefinition['id'],
      name: source.sourceId,
      description: 'ad-hoc workflow from external source',
      version: '0.0.0',
      mode: source.mode,
      steps: source.steps,
      failFast: source.failFast,
    };
    const execution = this.factory.create(definition, plan, source.projectId, source.missionId);
    const planned = this.factory.toPlanned(execution);
    this.registry.add(planned);
    await this.bus.publish(WorkflowCreated, {
      executionId: planned.id,
      workflowId: definition.id,
      projectId: source.projectId,
      missionId: source.missionId,
      timestamp: this.now(),
    });
    await this.bus.publish(WorkflowPlanned, {
      executionId: planned.id,
      workflowId: definition.id,
      mode: plan.mode,
      stepCount: plan.order.length,
      timestamp: this.now(),
    });
    return planned;
  }

  // --- start / drive ---------------------------------------------------------

  /**
   * Begin execution: `planned → running`. Emits `workflow.started`, then
   * immediately drives the first step (or wave) when a {@link StepExecutor} is
   * configured. When no executor is set, the run sits in `running` and is
   * advanced explicitly via `succeedStep`/`failStep`.
   */
  async start(id: WorkflowExecutionId): Promise<WorkflowExecution> {
    const current = this.require(id);
    const next = this.move(current, 'running');
    await this.bus.publish(WorkflowStarted, {
      executionId: next.id,
      workflowId: next.workflowId,
      timestamp: this.now(),
    });
    if (this.executor !== undefined) {
      await this.drive(next);
    }
    return this.registry.findExecution(next.id) ?? next;
  }

  /**
   * Internal driver. Walks the plan in dependency order, dispatching each ready
   * step (or wave) to the {@link StepExecutor} and reacting to results. Re-entrant
   * safe: it stops whenever the run is paused, cancelled, or terminal.
   */
  private async drive(execution: WorkflowExecution): Promise<void> {
    const executor = this.executor;
    if (executor === undefined) {
      return;
    }
    let current = execution;
    // Sequential dispatch: advance the cursor one step at a time.
    for (;;) {
      current = this.registry.findExecution(current.id) ?? current;
      if (isTerminal(current.state) || current.paused) {
        return;
      }
      const step = this.factory.nextStep(current);
      if (step === null) {
        await this.complete(current.id);
        return;
      }
      const record = current.steps.get(step.id);
      if (record === undefined || isStepTerminal(record.state)) {
        // Cursor already past it; advance.
        current = this.advanceCursor(current);
        continue;
      }
      const attempt = record.attempts + 1;
      const running = this.factory.withStep(
        current,
        runningRecord(step.id, attempt, this.now() as never),
      );
      this.registry.update(running);
      await this.bus.publish(WorkflowStepStarted, {
        executionId: running.id,
        workflowId: running.workflowId,
        stepId: step.id,
        attempt,
        timestamp: this.now(),
      });
      try {
        const context = {
          executionId: running.id,
          workflowId: running.workflowId,
          projectId: running.projectId,
          missionId: running.missionId,
          attempt,
          metadata: {},
        };
        const result = await executor.execute(step, context);
        const after = this.registry.findExecution(running.id) ?? running;
        if (after.paused || isTerminal(after.state)) {
          return;
        }
        if (result.ok) {
          await this.succeedStep(after.id, step.id);
        } else {
          await this.failStep(after.id, step.id, result.error);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.failStep(current.id, step.id, message);
      }
      const refreshed = this.registry.findExecution(current.id);
      if (refreshed === undefined || isTerminal(refreshed.state) || refreshed.paused) {
        return;
      }
      current = refreshed;
    }
  }

  // --- step outcomes (explicit, also used by the driver) ---------------------

  /** Mark a step succeeded. Emits `workflow.step-succeeded` and advances. */
  async succeedStep(id: WorkflowExecutionId, stepId: WorkflowStepId): Promise<WorkflowExecution> {
    const current = this.require(id);
    const record = this.requireStep(current, stepId);
    if (record.state === 'succeeded') {
      return current;
    }
    const updated = this.factory.withStep(
      current,
      succeededRecord(stepId, Math.max(record.attempts, 1), this.now() as never),
    );
    this.registry.update(updated);
    await this.bus.publish(WorkflowStepSucceeded, {
      executionId: updated.id,
      workflowId: updated.workflowId,
      stepId,
      attempts: Math.max(record.attempts, 1),
      timestamp: this.now(),
    });
    return this.afterStep(updated, stepId, true);
  }

  /**
   * Mark a step failed. Respects the retry budget: if attempts remain, the step
   * is retried (re-armed to `pending`); otherwise the run fails (or dependents
   * are skipped under non-fail-fast). Emits `workflow.step-failed` and either
   * `workflow.step-retried` or terminal events.
   */
  async failStep(
    id: WorkflowExecutionId,
    stepId: WorkflowStepId,
    error?: string,
  ): Promise<WorkflowExecution> {
    const current = this.require(id);
    const record = this.requireStep(current, stepId);
    // `record.attempts` already counts the attempt that just ran (the driver or
    // an explicit caller stamped it onto the `running` record before executing).
    const attempts = record.attempts;
    if (attempts < 1) {
      // Defensive: a step reported as failed without having been started.
      throw new WorkflowValidationError(stepId, 'cannot fail a step that never started');
    }
    const maxAttempts = current.plan.maxAttempts;
    const failed = this.factory.withStep(
      current,
      failedRecord(stepId, attempts, error ?? 'unknown error', this.now() as never),
    );
    this.registry.update(failed);
    await this.bus.publish(WorkflowStepFailed, {
      executionId: failed.id,
      workflowId: failed.workflowId,
      stepId,
      attempts,
      error: error ?? 'unknown error',
      timestamp: this.now(),
    });

    if (attempts < maxAttempts) {
      const retried = this.factory.withStep(failed, { stepId, state: 'pending', attempts });
      this.registry.update(retried);
      await this.bus.publish(WorkflowStepRetried, {
        executionId: retried.id,
        workflowId: retried.workflowId,
        stepId,
        attempt: attempts + 1,
        timestamp: this.now(),
      });
      if (this.executor !== undefined && !retried.paused && !isTerminal(retried.state)) {
        await this.drive(retried);
      }
      return retried;
    }

    // Out of retries: fail the run. (Per-step retry budget exhausted.)
    return this.failRun(failed, error ?? 'step failed');
  }

  /** Skip a step (e.g. when a non-fail-fast dependency failed). */
  async skipStep(id: WorkflowExecutionId, stepId: WorkflowStepId): Promise<WorkflowExecution> {
    const current = this.require(id);
    const updated = this.factory.withStep(current, skippedRecord(stepId));
    this.registry.update(updated);
    await this.bus.publish(WorkflowStepSkipped, {
      executionId: updated.id,
      workflowId: updated.workflowId,
      stepId,
      timestamp: this.now(),
    });
    return this.afterStep(updated, stepId, false);
  }

  // --- control signals -------------------------------------------------------

  /** Pause a running workflow. Emits `workflow.paused`. */
  async pause(id: WorkflowExecutionId): Promise<WorkflowExecution> {
    const current = this.require(id);
    if (current.state !== 'running') {
      throw new WorkflowStateError(id, current.state, 'pause');
    }
    const next: WorkflowExecution = {
      ...current,
      paused: true,
      updatedAt: this.now() as never,
    };
    this.registry.update(next);
    await this.bus.publish(WorkflowPaused, {
      executionId: next.id,
      workflowId: next.workflowId,
      progress: next.progress,
      timestamp: this.now(),
    });
    return next;
  }

  /** Resume a paused workflow. Emits `workflow.resumed` and re-drives if possible. */
  async resume(id: WorkflowExecutionId): Promise<WorkflowExecution> {
    const current = this.require(id);
    if (current.state !== 'running' || !current.paused) {
      throw new WorkflowStateError(id, current.state, 'resume');
    }
    const next: WorkflowExecution = {
      ...current,
      paused: false,
      updatedAt: this.now() as never,
    };
    this.registry.update(next);
    await this.bus.publish(WorkflowResumed, {
      executionId: next.id,
      workflowId: next.workflowId,
      timestamp: this.now(),
    });
    if (this.executor !== undefined) {
      await this.drive(next);
    }
    return next;
  }

  /** Cancel a workflow from any active state. Emits `workflow.cancelled`. */
  async cancel(
    id: WorkflowExecutionId,
    reason = 'cancelled by director',
  ): Promise<WorkflowExecution> {
    const current = this.require(id);
    const next = this.move(current, 'cancelled', {
      paused: false,
      cancellationReason: reason,
      steps: this.cancelSteps(current),
    });
    await this.bus.publish(WorkflowCancelled, {
      executionId: next.id,
      workflowId: next.workflowId,
      reason,
      timestamp: this.now(),
    });
    return next;
  }

  /**
   * Retry an entire failed workflow from the start: re-arms every step to
   * `pending`, moves `failed → running`, and re-drives. This is the run-level
   * retry; per-step retry is handled automatically in {@link failStep}.
   */
  async retry(id: WorkflowExecutionId): Promise<WorkflowExecution> {
    const current = this.require(id);
    if (current.state !== 'failed') {
      throw new WorkflowStateError(id, current.state, 'retry');
    }
    const rearmed = this.rearm(current);
    const next = this.move(rearmed, 'running', { failureReason: null });
    this.registry.update(next);
    this.logger.info('workflow.retry', { id: next.id });
    if (this.executor !== undefined) {
      await this.drive(next);
    }
    return next;
  }

  // --- queries ---------------------------------------------------------------

  /** List every tracked execution (insertion order). */
  list(): ReadonlyArray<WorkflowExecution> {
    return this.registry.executions();
  }

  /** Fetch an execution by id, or `undefined` when absent. */
  find(id: WorkflowExecutionId): WorkflowExecution | undefined {
    return this.registry.findExecution(id);
  }

  /** Fetch an execution by id, throwing {@link WorkflowNotFoundError} when absent. */
  get(id: WorkflowExecutionId): WorkflowExecution {
    return this.registry.getExecution(id);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.registry.clear();
  }

  // --- internals -------------------------------------------------------------

  private require(id: WorkflowExecutionId): WorkflowExecution {
    return this.registry.getExecution(id);
  }

  private requireStep(execution: WorkflowExecution, stepId: WorkflowStepId) {
    const record = execution.steps.get(stepId);
    if (record === undefined) {
      throw new WorkflowNotFoundError('execution', `${execution.id}:${stepId}`);
    }
    return record;
  }

  private move(
    execution: WorkflowExecution,
    to: WorkflowExecution['state'],
    patch: Partial<WorkflowExecution> = {},
  ): WorkflowExecution {
    if (isTerminal(execution.state)) {
      throw new WorkflowTerminalError(execution.id, execution.state);
    }
    if (!canTransition(execution.state, to)) {
      throw new WorkflowStateError(execution.id, execution.state, to, execution.workflowId);
    }
    const next = this.factory.transition(execution, to, patch);
    this.registry.update(next);
    return next;
  }

  /** Advance the sequential cursor past the just-finished step. */
  private advanceCursor(execution: WorkflowExecution): WorkflowExecution {
    const next: WorkflowExecution = {
      ...execution,
      cursor: Math.min(execution.cursor + 1, execution.plan.order.length),
      updatedAt: this.now() as never,
    };
    this.registry.update(next);
    return next;
  }

  /**
   * After a step finishes, advance the cursor. If the run has no remaining steps
   * it completes. (Non-fail-fast dependent skipping is reserved for the future
   * parallel runner; sequential fail-fast completes/fails here.)
   */
  private async afterStep(
    execution: WorkflowExecution,
    stepId: WorkflowStepId,
    succeeded: boolean,
  ): Promise<WorkflowExecution> {
    const record = execution.steps.get(stepId);
    if (succeeded && record?.state === 'succeeded') {
      const advanced = this.advanceCursor(execution);
      if (this.factory.nextStep(advanced) === null) {
        return this.complete(advanced.id);
      }
      if (this.executor !== undefined && !advanced.paused && !isTerminal(advanced.state)) {
        await this.drive(advanced);
      }
      return advanced;
    }
    return execution;
  }

  private async complete(id: WorkflowExecutionId): Promise<WorkflowExecution> {
    const current = this.require(id);
    const next = this.move(current, 'completed', { progress: 100 });
    await this.bus.publish(WorkflowCompleted, {
      executionId: next.id,
      workflowId: next.workflowId,
      timestamp: this.now(),
    });
    return next;
  }

  private async failRun(execution: WorkflowExecution, reason: string): Promise<WorkflowExecution> {
    const next = this.move(execution, 'failed', { failureReason: reason });
    await this.bus.publish(WorkflowFailed, {
      executionId: next.id,
      workflowId: next.workflowId,
      reason,
      timestamp: this.now(),
    });
    return next;
  }

  private rearm(execution: WorkflowExecution): WorkflowExecution {
    const steps = new Map(execution.steps);
    for (const [stepId, record] of steps) {
      steps.set(stepId, {
        stepId,
        state: 'pending',
        attempts: record.attempts,
      });
    }
    return {
      ...execution,
      state: 'planned',
      paused: false,
      steps,
      cursor: 0,
      failureReason: null,
      progress: 0,
      updatedAt: this.now() as never,
    };
  }

  private cancelSteps(execution: WorkflowExecution): WorkflowExecution['steps'] {
    const steps = new Map(execution.steps);
    for (const [stepId, record] of steps) {
      if (
        !isStepTerminal(record.state) ||
        record.state === 'running' ||
        record.state === 'pending'
      ) {
        steps.set(stepId, cancelledStepRecord(stepId));
      }
    }
    return steps;
  }

  private now(): number {
    return Date.now();
  }
}
