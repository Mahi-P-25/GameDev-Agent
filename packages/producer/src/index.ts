/**
 * Nova Producer — public API.
 *
 * The Producer is a domain service (not an AI model) that transforms a Creative
 * Director's high-level {@link Goal} into a structured, reviewable
 * {@link MissionProposal}. It analyses the Goal into Objectives and Milestones,
 * builds a {@link MissionTree} with dependencies and ordering, estimates the
 * required Roles and Capabilities, and assembles an {@link ApprovalPackage}. On
 * approval it emits `mission-proposal.ready` so the Coordinator receives the
 * tree and decides execution — the Producer never creates Coordinator Missions.
 *
 * It performs no LLM, Memory, Knowledge, Planner, or Role execution work itself;
 * those arrive in later sprints behind the future-integration interfaces defined
 * here. Only the surface below is exported; internal modules stay private.
 */

// --- domain model ------------------------------------------------------------
export type {
  GoalId,
  ObjectiveId,
  MilestoneId,
  ProposedMissionId,
  ProposalId,
  GoalStatus,
  GoalPriority,
  Priority,
  Complexity,
  GoalRequest,
  Goal,
  GoalAnalysis,
  Objective,
  Milestone,
  Dependency,
  ProposedMission,
  MissionTree,
  MissionProposal,
  ApprovalPackage,
  CapabilityEstimate,
  RoleEstimate,
  ProposalContext,
  ProjectId,
  JsonValue,
} from './ProducerTypes';
export {
  GOAL_LIFECYCLE,
  GOAL_TERMINAL_STATES,
  COMPLEXITY_ORDER,
} from './ProducerTypes';

// --- state machine -----------------------------------------------------------
export {
  allowedTransitions,
  canTransition,
  isTerminal,
  lifecycleIndex,
} from './ProducerState';

// --- errors ------------------------------------------------------------------
export {
  ProducerError,
  GoalValidationError,
  GoalStateError,
  GoalNotFoundError,
  DuplicateGoalError,
  MissionTreeError,
} from './ProducerErrors';
export type { ValidationViolation } from './ProducerErrors';

// --- events ------------------------------------------------------------------
export {
  GoalSubmitted,
  GoalAnalysing,
  GoalObjectivesGenerated,
  GoalMissionTreeGenerated,
  GoalReviewPackageGenerated,
  GoalApprovalRequested,
  GoalApproved,
  GoalRejected,
  MissionProposalReady,
} from './ProducerEvents';
export type {
  GoalSubmittedPayload,
  GoalAnalysingPayload,
  GoalObjectivesGeneratedPayload,
  GoalMissionTreeGeneratedPayload,
  GoalReviewPackageGeneratedPayload,
  GoalApprovalRequestedPayload,
  GoalApprovedPayload,
  GoalRejectedPayload,
  MissionProposalReadyPayload,
  ProducerEventPayloads,
} from './ProducerEvents';

// --- service + registry + analyzer + orchestrator ----------------------------
export { Producer, HeuristicGoalAnalyzer } from './Producer';
export type {
  ProducerOptions,
  GoalAnalyzer,
  AnalysisDraft,
  ObjectiveDraft,
  MilestoneDraft,
} from './Producer';
export {
  validateRequest,
  validateMissionTree,
  topologicalOrder,
  deriveRoleEstimates,
  capabilityToRole,
} from './Producer';
export { GoalRegistry } from './GoalRegistry';
export { ProducerManager } from './ProducerManager';
export type { ProducerManagerOptions } from './ProducerManager';

// --- kernel module -----------------------------------------------------------
export { PRODUCER_MANAGER_TOKEN, producerModule } from './ProducerModule';
