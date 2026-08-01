import type { EventDefinition } from '@gamedev-agent/events';
import type {
  ApprovalRequest,
  ApprovalResponse,
  Decision,
  GoalTree,
  MemoryRecord,
  MissionState,
  Observation,
  ProgressReport,
  StepPlan,
  Thought,
  ToolSelection,
  VerificationResult,
} from './types';

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

// ─── Payloads ──────────────────────────────────────────────────────────────

export interface MissionReasoningStateChangedPayload {
  readonly missionId: string;
  readonly previousState: MissionState;
  readonly currentState: MissionState;
  readonly timestamp: number;
}

export interface ReasoningThinkStartedPayload {
  readonly missionId: string;
  readonly goalNodeId: string;
  readonly timestamp: number;
}

export interface ReasoningThinkCompletedPayload {
  readonly missionId: string;
  readonly thought: Thought;
  readonly timestamp: number;
}

export interface ReasoningPlanCreatedPayload {
  readonly missionId: string;
  readonly plan: StepPlan;
  readonly timestamp: number;
}

export interface ReasoningToolSelectedPayload {
  readonly missionId: string;
  readonly selection: ToolSelection;
  readonly timestamp: number;
}

export interface ReasoningObservationCollectedPayload {
  readonly missionId: string;
  readonly observation: Observation;
  readonly timestamp: number;
}

export interface ReasoningVerificationStartedPayload {
  readonly missionId: string;
  readonly observationId: string;
  readonly timestamp: number;
}

export interface ReasoningVerificationCompletedPayload {
  readonly missionId: string;
  readonly verification: VerificationResult;
  readonly timestamp: number;
}

export interface ReasoningReflectionDecisionPayload {
  readonly missionId: string;
  readonly decision: Decision;
  readonly timestamp: number;
}

export interface ReasoningProgressUpdatedPayload {
  readonly missionId: string;
  readonly report: ProgressReport;
  readonly timestamp: number;
}

export interface ReasoningGoalTreeUpdatedPayload {
  readonly missionId: string;
  readonly goalTree: GoalTree;
  readonly timestamp: number;
}

export interface ReasoningApprovalRequestedPayload {
  readonly missionId: string;
  readonly request: ApprovalRequest;
  readonly timestamp: number;
}

export interface ReasoningApprovalResolvedPayload {
  readonly missionId: string;
  readonly response: ApprovalResponse;
  readonly timestamp: number;
}

export interface MemoryWrittenPayload {
  readonly missionId: string;
  readonly record: MemoryRecord;
  readonly timestamp: number;
}

// ─── Event Definitions ─────────────────────────────────────────────────────

export const MissionReasoningStateChanged = define<MissionReasoningStateChangedPayload>(
  'mission.reasoning.state.changed',
);
export const ReasoningThinkStarted = define<ReasoningThinkStartedPayload>(
  'mission.reasoning.think.started',
);
export const ReasoningThinkCompleted = define<ReasoningThinkCompletedPayload>(
  'mission.reasoning.think.completed',
);
export const ReasoningPlanCreated = define<ReasoningPlanCreatedPayload>(
  'mission.reasoning.plan.created',
);
export const ReasoningToolSelected = define<ReasoningToolSelectedPayload>(
  'mission.reasoning.tool.selected',
);
export const ReasoningObservationCollected = define<ReasoningObservationCollectedPayload>(
  'mission.reasoning.observation.collected',
);
export const ReasoningVerificationStarted = define<ReasoningVerificationStartedPayload>(
  'mission.reasoning.verification.started',
);
export const ReasoningVerificationCompleted = define<ReasoningVerificationCompletedPayload>(
  'mission.reasoning.verification.completed',
);
export const ReasoningReflectionDecision = define<ReasoningReflectionDecisionPayload>(
  'mission.reasoning.reflection.decision',
);
export const ReasoningProgressUpdated = define<ReasoningProgressUpdatedPayload>(
  'mission.reasoning.progress.updated',
);
export const ReasoningGoalTreeUpdated = define<ReasoningGoalTreeUpdatedPayload>(
  'mission.reasoning.goal_tree.updated',
);
export const ReasoningApprovalRequested = define<ReasoningApprovalRequestedPayload>(
  'mission.reasoning.approval.requested',
);
export const ReasoningApprovalResolved = define<ReasoningApprovalResolvedPayload>(
  'mission.reasoning.approval.resolved',
);
export const MemoryWritten = define<MemoryWrittenPayload>('memory.written');

export type ReasoningEventPayloads =
  | MissionReasoningStateChangedPayload
  | ReasoningThinkStartedPayload
  | ReasoningThinkCompletedPayload
  | ReasoningPlanCreatedPayload
  | ReasoningToolSelectedPayload
  | ReasoningObservationCollectedPayload
  | ReasoningVerificationStartedPayload
  | ReasoningVerificationCompletedPayload
  | ReasoningReflectionDecisionPayload
  | ReasoningProgressUpdatedPayload
  | ReasoningGoalTreeUpdatedPayload
  | ReasoningApprovalRequestedPayload
  | ReasoningApprovalResolvedPayload
  | MemoryWrittenPayload;
