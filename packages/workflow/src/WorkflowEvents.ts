import type { EventDefinition } from '@gamedev-agent/events';
import type {
  MissionId,
  ProjectId,
  WorkflowExecutionId,
  WorkflowId,
  WorkflowStepId,
  WorkflowStepState,
} from './WorkflowDefinition';

/**
 * Strongly-typed event catalog for the Nova Workflow Engine.
 *
 * Every meaningful engine action emits a typed {@link EventDefinition} (stable
 * `type` + `version: 1`), following the Nova convention `<aggregate>.<pastTenseVerb>`
 * (e.g. `workflow.planned`). Subscribers bind to the definition, not a magic
 * string, so payloads are fully inferred and the compiler catches drift. The
 * engine publishes these through the shared Event Bus — it never calls other
 * packages directly. This is how future subsystems (Execution Engine, Roles,
 * Memory, Studio UI) observe workflow progress without the engine depending on
 * them.
 */

export interface WorkflowRegisteredPayload {
  readonly workflowId: WorkflowId;
  readonly name: string;
  readonly version: string;
  readonly timestamp: number;
}

export interface WorkflowUnregisteredPayload {
  readonly workflowId: WorkflowId;
  readonly timestamp: number;
}

export interface WorkflowCreatedPayload {
  readonly executionId: WorkflowExecutionId;
  readonly workflowId: WorkflowId;
  readonly projectId: ProjectId;
  readonly missionId: MissionId | null;
  readonly timestamp: number;
}

export interface WorkflowPlannedPayload {
  readonly executionId: WorkflowExecutionId;
  readonly workflowId: WorkflowId;
  readonly mode: string;
  readonly stepCount: number;
  readonly timestamp: number;
}

export interface WorkflowStartedPayload {
  readonly executionId: WorkflowExecutionId;
  readonly workflowId: WorkflowId;
  readonly timestamp: number;
}

export interface WorkflowPausedPayload {
  readonly executionId: WorkflowExecutionId;
  readonly workflowId: WorkflowId;
  readonly progress: number;
  readonly timestamp: number;
}

export interface WorkflowResumedPayload {
  readonly executionId: WorkflowExecutionId;
  readonly workflowId: WorkflowId;
  readonly timestamp: number;
}

export interface WorkflowCancelledPayload {
  readonly executionId: WorkflowExecutionId;
  readonly workflowId: WorkflowId;
  readonly reason: string;
  readonly timestamp: number;
}

export interface WorkflowCompletedPayload {
  readonly executionId: WorkflowExecutionId;
  readonly workflowId: WorkflowId;
  readonly timestamp: number;
}

export interface WorkflowFailedPayload {
  readonly executionId: WorkflowExecutionId;
  readonly workflowId: WorkflowId;
  readonly reason: string;
  readonly timestamp: number;
}

export interface WorkflowStepStartedPayload {
  readonly executionId: WorkflowExecutionId;
  readonly workflowId: WorkflowId;
  readonly stepId: WorkflowStepId;
  readonly attempt: number;
  readonly timestamp: number;
}

export interface WorkflowStepSucceededPayload {
  readonly executionId: WorkflowExecutionId;
  readonly workflowId: WorkflowId;
  readonly stepId: WorkflowStepId;
  readonly attempts: number;
  readonly timestamp: number;
}

export interface WorkflowStepFailedPayload {
  readonly executionId: WorkflowExecutionId;
  readonly workflowId: WorkflowId;
  readonly stepId: WorkflowStepId;
  readonly attempts: number;
  readonly error?: string;
  readonly timestamp: number;
}

export interface WorkflowStepRetriedPayload {
  readonly executionId: WorkflowExecutionId;
  readonly workflowId: WorkflowId;
  readonly stepId: WorkflowStepId;
  readonly attempt: number;
  readonly timestamp: number;
}

export interface WorkflowStepSkippedPayload {
  readonly executionId: WorkflowExecutionId;
  readonly workflowId: WorkflowId;
  readonly stepId: WorkflowStepId;
  readonly timestamp: number;
}

export const WorkflowRegistered = define<WorkflowRegisteredPayload>('workflow.registered');
export const WorkflowUnregistered = define<WorkflowUnregisteredPayload>('workflow.unregistered');
export const WorkflowCreated = define<WorkflowCreatedPayload>('workflow.created');
export const WorkflowPlanned = define<WorkflowPlannedPayload>('workflow.planned');
export const WorkflowStarted = define<WorkflowStartedPayload>('workflow.started');
export const WorkflowPaused = define<WorkflowPausedPayload>('workflow.paused');
export const WorkflowResumed = define<WorkflowResumedPayload>('workflow.resumed');
export const WorkflowCancelled = define<WorkflowCancelledPayload>('workflow.cancelled');
export const WorkflowCompleted = define<WorkflowCompletedPayload>('workflow.completed');
export const WorkflowFailed = define<WorkflowFailedPayload>('workflow.failed');
export const WorkflowStepStarted = define<WorkflowStepStartedPayload>('workflow.step-started');
export const WorkflowStepSucceeded =
  define<WorkflowStepSucceededPayload>('workflow.step-succeeded');
export const WorkflowStepFailed = define<WorkflowStepFailedPayload>('workflow.step-failed');
export const WorkflowStepRetried = define<WorkflowStepRetriedPayload>('workflow.step-retried');
export const WorkflowStepSkipped = define<WorkflowStepSkippedPayload>('workflow.step-skipped');

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

/** All workflow event payloads, for consumers that need a union. */
export type WorkflowEventPayloads =
  | WorkflowRegisteredPayload
  | WorkflowUnregisteredPayload
  | WorkflowCreatedPayload
  | WorkflowPlannedPayload
  | WorkflowStartedPayload
  | WorkflowPausedPayload
  | WorkflowResumedPayload
  | WorkflowCancelledPayload
  | WorkflowCompletedPayload
  | WorkflowFailedPayload
  | WorkflowStepStartedPayload
  | WorkflowStepSucceededPayload
  | WorkflowStepFailedPayload
  | WorkflowStepRetriedPayload
  | WorkflowStepSkippedPayload;

/** Re-exported for subscribers that wish to type a handler against local entities. */
export type { WorkflowStepState };
