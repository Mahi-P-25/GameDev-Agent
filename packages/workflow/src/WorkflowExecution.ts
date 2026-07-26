import type { Clock, IdGenerator } from '@gamedev-agent/events';
import type { Timestamp, UUID } from '@gamedev-agent/shared';
import type {
  JsonValue,
  MissionId,
  ProjectId,
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowExecutionId,
  WorkflowPlan,
  WorkflowStep,
  WorkflowStepId,
  WorkflowStepRecord,
  WorkflowStepState,
} from './WorkflowDefinition';
import { WorkflowValidationError } from './WorkflowErrors';
import type { WorkflowState } from './WorkflowState';

/**
 * Factory and validation for {@link WorkflowExecution} aggregates and the
 * {@link WorkflowStepRecord}s that make up a run.
 *
 * Like the Coordinator, the Workflow package keeps *construction* in one pure,
 * testable unit: `Clock` and `IdGenerator` are injected so tests get
 * deterministic ids/timestamps and the factory never touches `Date.now()` /
 * `crypto` directly. The factory is pure — it validates, derives, and returns
 * new objects; it never stores, emits, or transitions on its own. Orchestration
 * (state changes, event emission, registry writes) lives in the
 * {@link WorkflowManager}.
 */
export interface WorkflowExecutionOptions {
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
}

const defaultClock = (): Clock => ({
  now: () => Date.now(),
});

const defaultIds = (): IdGenerator => ({
  generate: () => crypto.randomUUID(),
});

/**
 * Builds {@link WorkflowExecution} aggregates from a planned {@link WorkflowPlan}
 * and applies step-level and run-level transitions immutably.
 */
export class WorkflowExecutionFactory {
  private readonly clock: Clock;
  private readonly generateId: IdGenerator;

  constructor(options: WorkflowExecutionOptions = {}) {
    this.clock = options.clock ?? defaultClock();
    this.generateId = options.idGenerator ?? defaultIds();
  }

  /** Create a fresh, `created`-state execution for a planned workflow. */
  create(
    definition: WorkflowDefinition,
    plan: WorkflowPlan,
    projectId: ProjectId,
    missionId: MissionId | null,
    metadata: Readonly<Record<string, JsonValue>> = {},
  ): WorkflowExecution {
    const now = this.clock.now() as Timestamp;
    const id = this.generateId.generate() as UUID as WorkflowExecutionId;
    const steps = new Map<WorkflowStepId, WorkflowStepRecord>();
    for (const stepId of plan.order) {
      const step = plan.steps.get(stepId);
      if (step === undefined) {
        throw new WorkflowValidationError(stepId, 'step missing from plan map');
      }
      steps.set(stepId, pendingRecord(stepId));
    }
    return {
      id,
      workflowId: definition.id,
      projectId,
      missionId,
      plan,
      state: 'created',
      paused: false,
      steps,
      cursor: 0,
      failureReason: null,
      cancellationReason: null,
      progress: 0,
      createdAt: now,
      updatedAt: now,
      metadata,
    };
  }

  /** Generate a fresh unique id (for correlation with callers). */
  generateExecutionId(): WorkflowExecutionId {
    return this.generateId.generate() as UUID as WorkflowExecutionId;
  }

  /** Mark the run as `planned`, leaving step records untouched. */
  toPlanned(execution: WorkflowExecution): WorkflowExecution {
    return {
      ...execution,
      state: 'planned',
      updatedAt: this.clock.now() as Timestamp,
    };
  }

  /** Compute overall progress (0–100) from completed steps. */
  progressOf(execution: WorkflowExecution): number {
    const total = execution.steps.size;
    if (total === 0) {
      return execution.state === 'completed' ? 100 : 0;
    }
    let done = 0;
    for (const record of execution.steps.values()) {
      if (record.state === 'succeeded' || record.state === 'skipped') {
        done += 1;
      }
    }
    return Math.round((done / total) * 100);
  }

  /**
   * Apply a lifecycle transition to the run, returning a *new* aggregate. Re-stamps
   * `updatedAt`. Terminal states cannot be left.
   */
  transition(
    execution: WorkflowExecution,
    to: WorkflowState,
    patch: Partial<WorkflowExecution> = {},
  ): WorkflowExecution {
    const next: WorkflowExecution = {
      ...execution,
      ...patch,
      state: to,
      updatedAt: this.clock.now() as Timestamp,
    };
    return next;
  }

  /** Replace a single step record immutably. */
  withStep(execution: WorkflowExecution, record: WorkflowStepRecord): WorkflowExecution {
    const steps = new Map(execution.steps);
    steps.set(record.stepId, record);
    return {
      ...execution,
      steps,
      progress: this.progressOf({ ...execution, steps }),
      updatedAt: this.clock.now() as Timestamp,
    };
  }

  /** Returns the next step that needs work in sequential mode (cursor-based). */
  nextStep(execution: WorkflowExecution): WorkflowStep | null {
    if (execution.cursor < execution.plan.order.length) {
      const stepId = execution.plan.order[execution.cursor];
      if (stepId !== undefined) {
        return execution.plan.steps.get(stepId) ?? null;
      }
    }
    return null;
  }
}

/** Build a `pending` step record for a brand-new step. */
export function pendingRecord(stepId: WorkflowStepId): WorkflowStepRecord {
  return { stepId, state: 'pending', attempts: 0 };
}

/** Build a `running` step record for the start of an attempt. */
export function runningRecord(
  stepId: WorkflowStepId,
  attempt: number,
  startedAt: Timestamp,
): WorkflowStepRecord {
  return { stepId, state: 'running', attempts: attempt, startedAt };
}

/** Build a `succeeded` step record. */
export function succeededRecord(
  stepId: WorkflowStepId,
  attempts: number,
  finishedAt: Timestamp,
): WorkflowStepRecord {
  return { stepId, state: 'succeeded', attempts, finishedAt };
}

/** Build a `failed` step record. */
export function failedRecord(
  stepId: WorkflowStepId,
  attempts: number,
  error: string,
  finishedAt: Timestamp,
): WorkflowStepRecord {
  return { stepId, state: 'failed', attempts, error, finishedAt };
}

/** Build a `skipped` step record. */
export function skippedRecord(stepId: WorkflowStepId): WorkflowStepRecord {
  return { stepId, state: 'skipped', attempts: 0 };
}

/** Build a `cancelled` step record. */
export function cancelledStepRecord(stepId: WorkflowStepId): WorkflowStepRecord {
  return { stepId, state: 'cancelled', attempts: 0 };
}

/** True when a step state is terminal (no further attempts possible). */
export function isStepTerminal(state: WorkflowStepState): boolean {
  return (
    state === 'succeeded' || state === 'failed' || state === 'skipped' || state === 'cancelled'
  );
}
