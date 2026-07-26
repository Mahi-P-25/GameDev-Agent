import type { EventDefinition } from '@gamedev-agent/events';
import type {
  ApprovalRequest,
  ExecutionContext,
  Mission,
  MissionId,
  MissionPriority,
  ProjectId,
  RoleAssignment,
  RoleRequirement,
} from './CoordinatorTypes';

/**
 * Strongly-typed event catalog for the Nova Studio Coordinator.
 *
 * Every {@link Mission} lifecycle transition emits a typed {@link EventDefinition}
 * (stable `type` + `version: 1`), following the Nova convention
 * `<aggregate>.<pastTenseVerb>` (e.g. `mission.submitted`). Subscribers bind to
 * the definition, not a magic string, so payloads are fully inferred and the
 * compiler catches drift. The Coordinator publishes these through the shared
 * Event Bus — it never calls other packages directly. This is how future
 * subsystems (Roles, Planner, Execution, Memory, Knowledge) observe Mission
 * progress without the Coordinator depending on them.
 */

export interface MissionSubmittedPayload {
  readonly missionId: MissionId;
  readonly projectId: ProjectId;
  readonly title: string;
  readonly priority: MissionPriority;
  readonly timestamp: number;
}

export interface MissionAcceptedPayload {
  readonly missionId: MissionId;
  readonly projectId: ProjectId;
  readonly roleRequirements: ReadonlyArray<RoleRequirement>;
  readonly timestamp: number;
}

export interface MissionAnalysingPayload {
  readonly missionId: MissionId;
  readonly timestamp: number;
}

export interface MissionApprovalRequestedPayload {
  readonly missionId: MissionId;
  readonly approval: ApprovalRequest;
  readonly timestamp: number;
}

export interface MissionApprovedPayload {
  readonly missionId: MissionId;
  readonly approver?: string | undefined;
  readonly timestamp: number;
}

export interface MissionReadyPayload {
  readonly missionId: MissionId;
  readonly timestamp: number;
}

export interface MissionExecutionStartedPayload {
  readonly missionId: MissionId;
  readonly execution: ExecutionContext;
  readonly timestamp: number;
}

export interface MissionExecutionPausedPayload {
  readonly missionId: MissionId;
  readonly progress: number;
  readonly timestamp: number;
}

export interface MissionReviewingPayload {
  readonly missionId: MissionId;
  readonly timestamp: number;
}

export interface MissionCompletedPayload {
  readonly missionId: MissionId;
  readonly timestamp: number;
}

export interface MissionFailedPayload {
  readonly missionId: MissionId;
  readonly reason: string;
  readonly timestamp: number;
}

export interface MissionCancelledPayload {
  readonly missionId: MissionId;
  readonly reason: string;
  readonly timestamp: number;
}

export const MissionSubmitted = define<MissionSubmittedPayload>('mission.submitted');
export const MissionAccepted = define<MissionAcceptedPayload>('mission.accepted');
export const MissionAnalysing = define<MissionAnalysingPayload>('mission.analysing');
export const MissionApprovalRequested = define<MissionApprovalRequestedPayload>(
  'mission.approval-requested',
);
export const MissionApproved = define<MissionApprovedPayload>('mission.approved');
export const MissionReady = define<MissionReadyPayload>('mission.ready');
export const MissionExecutionStarted = define<MissionExecutionStartedPayload>(
  'mission.execution-started',
);
export const MissionExecutionPaused = define<MissionExecutionPausedPayload>(
  'mission.execution-paused',
);
export const MissionReviewing = define<MissionReviewingPayload>('mission.reviewing');
export const MissionCompleted = define<MissionCompletedPayload>('mission.completed');
export const MissionFailed = define<MissionFailedPayload>('mission.failed');
export const MissionCancelled = define<MissionCancelledPayload>('mission.cancelled');

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

/** All coordinator event payloads, for consumers that need a union. */
export type CoordinatorEventPayloads =
  | MissionSubmittedPayload
  | MissionAcceptedPayload
  | MissionAnalysingPayload
  | MissionApprovalRequestedPayload
  | MissionApprovedPayload
  | MissionReadyPayload
  | MissionExecutionStartedPayload
  | MissionExecutionPausedPayload
  | MissionReviewingPayload
  | MissionCompletedPayload
  | MissionFailedPayload
  | MissionCancelledPayload;

/** Re-exported for subscribers that wish to type a handler against the entity. */
export type { Mission, RoleAssignment };
