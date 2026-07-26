/**
 * Nova Studio Coordinator — public API.
 *
 * The orchestration entry point for every Mission. The Coordinator owns the
 * Mission lifecycle and state, emits strongly-typed lifecycle events over the
 * shared Event Bus, and defines the future-integration interfaces that the Role
 * System, Planner, and Execution subsystems will implement. It performs no
 * execution, AI, planning, memory, or knowledge work itself.
 *
 * Only the surface below is exported; internal modules stay private so future
 * refactors do not break consumers.
 */

// --- domain model ------------------------------------------------------------
export type {
  MissionId,
  MissionStatus,
  MissionPriority,
  MissionRequest,
  Mission,
  MissionContext,
  CapabilityRequirement,
  RoleRequirement,
  RoleAssignment,
  ApprovalRequest,
  ExecutionContext,
  ExecutionPlan,
  ExecutionStep,
  ProjectId,
  JsonValue,
} from './CoordinatorTypes';
export { MISSION_LIFECYCLE, MISSION_TERMINAL_STATES } from './CoordinatorTypes';

// --- state machine -----------------------------------------------------------
export {
  allowedTransitions,
  canTransition,
  isTerminal,
  lifecycleIndex,
} from './CoordinatorState';

// --- errors ------------------------------------------------------------------
export {
  CoordinatorError,
  MissionValidationError,
  MissionStateError,
  MissionNotFoundError,
  MissionApprovalError,
  DuplicateMissionError,
} from './CoordinatorErrors';
export type { ValidationViolation } from './CoordinatorErrors';

// --- events ------------------------------------------------------------------
export {
  MissionSubmitted,
  MissionAccepted,
  MissionAnalysing,
  MissionApprovalRequested,
  MissionApproved,
  MissionReady,
  MissionExecutionStarted,
  MissionExecutionPaused,
  MissionReviewing,
  MissionCompleted,
  MissionFailed,
  MissionCancelled,
} from './CoordinatorEvents';
export type {
  MissionSubmittedPayload,
  MissionAcceptedPayload,
  MissionAnalysingPayload,
  MissionApprovalRequestedPayload,
  MissionApprovedPayload,
  MissionReadyPayload,
  MissionExecutionStartedPayload,
  MissionExecutionPausedPayload,
  MissionReviewingPayload,
  MissionCompletedPayload,
  MissionFailedPayload,
  MissionCancelledPayload,
  CoordinatorEventPayloads,
} from './CoordinatorEvents';

// --- factory + registry + orchestrator ---------------------------------------
export { Coordinator } from './Coordinator';
export type { CoordinatorOptions } from './Coordinator';
export {
  deriveRoleRequirements,
  validateRequest,
  validateMission,
  assertValidMission,
} from './Coordinator';
export { MissionRegistry } from './MissionRegistry';
export { CoordinatorManager } from './CoordinatorManager';
export type { CoordinatorManagerOptions } from './CoordinatorManager';

// --- kernel module -----------------------------------------------------------
export { COORDINATOR_MANAGER_TOKEN, coordinatorModule } from './CoordinatorModule';
