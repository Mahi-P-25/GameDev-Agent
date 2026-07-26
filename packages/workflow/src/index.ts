/**
 * Nova Workflow Engine — public API.
 *
 * The Workflow Engine coordinates execution of approved Mission Trees: it
 * determines execution order, respects dependencies, supports sequential
 * execution (and a built-in seam for future parallel execution), and provides
 * pause / resume / cancel / retry control. It performs no execution itself —
 * real step work is delegated to a future Execution Engine / Role System through
 * the {@link StepExecutor} interface. It integrates only with the Coordinator,
 * the Capability framework, the Event Bus, and the Studio API.
 *
 * Only the surface below is exported; internal modules stay private so future
 * refactors do not break consumers.
 */

// --- domain model ------------------------------------------------------------
export type {
  WorkflowId,
  WorkflowStepId,
  WorkflowExecutionId,
  WorkflowExecutionMode,
  WorkflowStep,
  WorkflowDefinition,
  WorkflowPlan,
  WorkflowExecution,
  WorkflowStepState,
  WorkflowStepRecord,
  WorkflowRequest,
  WorkflowSource,
  StepExecutor,
  WorkflowStepContext,
  StepResult,
  MissionId,
  ProjectId,
  JsonValue,
} from './WorkflowDefinition';

// --- state machine -----------------------------------------------------------
export {
  allowedTransitions,
  canTransition,
  isTerminal,
  WORKFLOW_LIFECYCLE,
  WORKFLOW_TERMINAL_STATES,
} from './WorkflowState';
export type { WorkflowState } from './WorkflowState';

// --- errors ------------------------------------------------------------------
export {
  WorkflowError,
  WorkflowValidationError,
  WorkflowStateError,
  WorkflowNotFoundError,
  DuplicateWorkflowError,
  WorkflowTerminalError,
  WorkflowRetryError,
} from './WorkflowErrors';

// --- events ------------------------------------------------------------------
export {
  WorkflowRegistered,
  WorkflowUnregistered,
  WorkflowCreated,
  WorkflowPlanned,
  WorkflowStarted,
  WorkflowPaused,
  WorkflowResumed,
  WorkflowCancelled,
  WorkflowCompleted,
  WorkflowFailed,
  WorkflowStepStarted,
  WorkflowStepSucceeded,
  WorkflowStepFailed,
  WorkflowStepRetried,
  WorkflowStepSkipped,
} from './WorkflowEvents';
export type {
  WorkflowRegisteredPayload,
  WorkflowUnregisteredPayload,
  WorkflowCreatedPayload,
  WorkflowPlannedPayload,
  WorkflowStartedPayload,
  WorkflowPausedPayload,
  WorkflowResumedPayload,
  WorkflowCancelledPayload,
  WorkflowCompletedPayload,
  WorkflowFailedPayload,
  WorkflowStepStartedPayload,
  WorkflowStepSucceededPayload,
  WorkflowStepFailedPayload,
  WorkflowStepRetriedPayload,
  WorkflowStepSkippedPayload,
  WorkflowEventPayloads,
} from './WorkflowEvents';

// --- planner + registry + execution factory ----------------------------------
export { Workflow } from './Workflow';
export type { WorkflowPlannerOptions } from './Workflow';
export { WorkflowRegistry } from './WorkflowRegistry';
export { WorkflowExecutionFactory } from './WorkflowExecution';
export type { WorkflowExecutionOptions } from './WorkflowExecution';
export {
  pendingRecord,
  runningRecord,
  succeededRecord,
  failedRecord,
  skippedRecord,
  cancelledStepRecord,
  isStepTerminal,
} from './WorkflowExecution';

// --- orchestrator ------------------------------------------------------------
export { WorkflowManager } from './WorkflowManager';
export type { WorkflowManagerOptions } from './WorkflowManager';

// --- kernel module -----------------------------------------------------------
export { WORKFLOW_MANAGER_TOKEN, WORKFLOW_EXECUTOR_TOKEN, workflowModule } from './WorkflowModule';
