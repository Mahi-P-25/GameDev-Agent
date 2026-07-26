/**
 * Nova Planning Engine — public API.
 *
 * The Planner transforms an *approved* Mission Tree (a `MissionProposal` handed
 * over by the Producer via the Coordinator) into an **immutable**
 * {@link ExecutionPlan}. It validates dependencies, groups related work into
 * {@link ExecutionPhase}s, packs each phase with parallel-capable
 * {@link ExecutionGroup}s, estimates execution order, and records
 * {@link ExecutionConstraint}s. It performs no LLM, Memory, Knowledge, or Role
 * execution work — it produces a plan; the Workflow Engine consumes and runs it.
 *
 * Only the surface below is exported; internal modules stay private so future
 * refactors do not break consumers.
 */

// --- domain model ------------------------------------------------------------
export type {
  PlanId,
  ExecutionPhaseId,
  ExecutionGroupId,
  ExecutionStepId,
  GroupMode,
  ExecutionStep,
  ExecutionGroup,
  ExecutionPhase,
  ExecutionConstraint,
  ExecutionConstraintKind,
  ExecutionPlan,
  PlanRequest,
  PlanningStrategy,
  StrategyContext,
  PlanningContextProvider,
  StepAssignmentAdvisor,
  ProjectId,
  MissionId,
  MissionProposal,
  ProposedMission,
  ProposedMissionId,
  WorkflowExecutionMode,
  WorkflowSource,
  WorkflowStep,
  JsonValue,
} from './PlannerTypes';

// --- engine + strategies ------------------------------------------------------
export { Planner } from './Planner';
export type { PlannerOptions } from './Planner';
export {
  DependencyGraphStrategy,
  SequentialPlanningStrategy,
  BUILTIN_STRATEGIES,
  toWorkflowSource,
} from './PlanningStrategy';

// --- errors ------------------------------------------------------------------
export {
  PlannerError,
  PlanValidationError,
  PlanGraphError,
  PlanConstraintError,
  PlanNotFoundError,
  UnknownStrategyError,
  ProposalNotApprovedError,
  DuplicatePlanError,
} from './PlannerErrors';
export type { PlanViolation } from './PlannerErrors';

// --- events ------------------------------------------------------------------
export { PlanRequested, PlanCreated, PlanFailed } from './PlannerEvents';
export type {
  PlanRequestedPayload,
  PlanCreatedPayload,
  PlanFailedPayload,
  PlannerEventPayloads,
} from './PlannerEvents';

// --- registry + orchestrator -------------------------------------------------
export { PlannerRegistry } from './PlannerRegistry';
export { PlannerManager } from './PlannerManager';
export type { PlannerManagerOptions } from './PlannerManager';

// --- kernel module -----------------------------------------------------------
export { PLANNER_MANAGER_TOKEN, plannerModule } from './PlannerModule';
