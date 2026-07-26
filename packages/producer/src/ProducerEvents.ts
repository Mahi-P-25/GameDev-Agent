import type { EventDefinition } from '@gamedev-agent/events';
import type {
  ApprovalPackage,
  Goal,
  GoalAnalysis,
  GoalId,
  GoalPriority,
  MissionProposal,
  MissionTree,
  ProjectId,
} from './ProducerTypes';

/**
 * Strongly-typed event catalog for the Nova Producer.
 *
 * Every {@link Goal} lifecycle transition emits a typed {@link EventDefinition}
 * (stable `type` + `version: 1`), following the Nova convention
 * `<aggregate>.<pastTenseVerb>` (e.g. `goal.submitted`). Subscribers bind to the
 * definition, not a magic string, so payloads are fully inferred and the
 * compiler catches drift. The Producer publishes these through the shared Event
 * Bus — it never calls other packages directly. This is how the Coordinator (and
 * future subsystems: Planner, Memory, Knowledge, Roles) observe Goal analysis
 * and receive the proposed Mission Tree without the Producer depending on them.
 */

export interface GoalSubmittedPayload {
  readonly goalId: GoalId;
  readonly projectId: ProjectId;
  readonly title: string;
  readonly priority: GoalPriority;
  readonly timestamp: number;
}

export interface GoalAnalysingPayload {
  readonly goalId: GoalId;
  readonly timestamp: number;
}

export interface GoalObjectivesGeneratedPayload {
  readonly goalId: GoalId;
  readonly analysis: GoalAnalysis;
  readonly timestamp: number;
}

export interface GoalMissionTreeGeneratedPayload {
  readonly goalId: GoalId;
  readonly missionTree: MissionTree;
  readonly timestamp: number;
}

export interface GoalReviewPackageGeneratedPayload {
  readonly goalId: GoalId;
  readonly approvalPackage: ApprovalPackage;
  readonly timestamp: number;
}

export interface GoalApprovalRequestedPayload {
  readonly goalId: GoalId;
  readonly approvalPackage: ApprovalPackage;
  readonly timestamp: number;
}

export interface GoalApprovedPayload {
  readonly goalId: GoalId;
  readonly proposal: MissionProposal;
  readonly approver?: string | undefined;
  readonly timestamp: number;
}

export interface GoalRejectedPayload {
  readonly goalId: GoalId;
  readonly reason: string;
  readonly timestamp: number;
}

/**
 * Emitted when a Goal is approved and its Mission Tree is handed to the
 * Coordinator. The Coordinator subscribes to this to receive the proposal and
 * decide execution — the Producer never creates Coordinator Missions directly.
 */
export interface MissionProposalReadyPayload {
  readonly goalId: GoalId;
  readonly projectId: ProjectId;
  readonly proposal: MissionProposal;
  readonly timestamp: number;
}

export const GoalSubmitted = define<GoalSubmittedPayload>('goal.submitted');
export const GoalAnalysing = define<GoalAnalysingPayload>('goal.analysing');
export const GoalObjectivesGenerated = define<GoalObjectivesGeneratedPayload>(
  'goal.objectives-generated',
);
export const GoalMissionTreeGenerated = define<GoalMissionTreeGeneratedPayload>(
  'goal.mission-tree-generated',
);
export const GoalReviewPackageGenerated = define<GoalReviewPackageGeneratedPayload>(
  'goal.review-package-generated',
);
export const GoalApprovalRequested =
  define<GoalApprovalRequestedPayload>('goal.approval-requested');
export const GoalApproved = define<GoalApprovedPayload>('goal.approved');
export const GoalRejected = define<GoalRejectedPayload>('goal.rejected');
export const MissionProposalReady = define<MissionProposalReadyPayload>('mission-proposal.ready');

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

/** All producer event payloads, for consumers that need a union. */
export type ProducerEventPayloads =
  | GoalSubmittedPayload
  | GoalAnalysingPayload
  | GoalObjectivesGeneratedPayload
  | GoalMissionTreeGeneratedPayload
  | GoalReviewPackageGeneratedPayload
  | GoalApprovalRequestedPayload
  | GoalApprovedPayload
  | GoalRejectedPayload
  | MissionProposalReadyPayload;

/** Re-exported for subscribers that wish to type a handler against the entity. */
export type { Goal, MissionProposal, MissionTree };
