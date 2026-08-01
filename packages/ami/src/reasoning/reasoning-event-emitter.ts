import type { EventBusContract, EventDefinition } from '@gamedev-agent/events';
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
import {
  MemoryWritten,
  MissionReasoningStateChanged,
  ReasoningApprovalRequested,
  ReasoningApprovalResolved,
  ReasoningGoalTreeUpdated,
  ReasoningObservationCollected,
  ReasoningPlanCreated,
  ReasoningProgressUpdated,
  ReasoningReflectionDecision,
  ReasoningThinkCompleted,
  ReasoningThinkStarted,
  ReasoningToolSelected,
  ReasoningVerificationCompleted,
  ReasoningVerificationStarted,
} from './reasoning-events';

/**
 * Thin, typed wrapper over the shared Event Bus for all AMI reasoning events.
 * The loop and its collaborators call these methods; nobody calls
 * `bus.publish` with raw payloads. All timestamps come from the bus's own
 * metadata at publish time — these payloads deliberately carry no clock.
 */
export class ReasoningEventEmitter {
  constructor(private readonly bus: EventBusContract) {}

  stateChanged(missionId: string, previousState: MissionState, currentState: MissionState): Promise<void> {
    return this.publish(MissionReasoningStateChanged, { missionId, previousState, currentState });
  }

  thinkStarted(missionId: string, goalNodeId: string): Promise<void> {
    return this.publish(ReasoningThinkStarted, { missionId, goalNodeId });
  }

  thinkCompleted(missionId: string, thought: Thought): Promise<void> {
    return this.publish(ReasoningThinkCompleted, { missionId, thought });
  }

  planCreated(missionId: string, plan: StepPlan): Promise<void> {
    return this.publish(ReasoningPlanCreated, { missionId, plan });
  }

  toolSelected(missionId: string, selection: ToolSelection): Promise<void> {
    return this.publish(ReasoningToolSelected, { missionId, selection });
  }

  observationCollected(missionId: string, observation: Observation): Promise<void> {
    return this.publish(ReasoningObservationCollected, { missionId, observation });
  }

  verificationStarted(missionId: string, observationId: string): Promise<void> {
    return this.publish(ReasoningVerificationStarted, { missionId, observationId });
  }

  verificationCompleted(missionId: string, verification: VerificationResult): Promise<void> {
    return this.publish(ReasoningVerificationCompleted, { missionId, verification });
  }

  reflectionDecision(missionId: string, decision: Decision): Promise<void> {
    return this.publish(ReasoningReflectionDecision, { missionId, decision });
  }

  progressUpdated(missionId: string, report: ProgressReport): Promise<void> {
    return this.publish(ReasoningProgressUpdated, { missionId, report });
  }

  goalTreeUpdated(missionId: string, goalTree: GoalTree): Promise<void> {
    return this.publish(ReasoningGoalTreeUpdated, { missionId, goalTree });
  }

  approvalRequested(missionId: string, request: ApprovalRequest): Promise<void> {
    return this.publish(ReasoningApprovalRequested, { missionId, request });
  }

  approvalResolved(missionId: string, response: ApprovalResponse): Promise<void> {
    return this.publish(ReasoningApprovalResolved, { missionId, response });
  }

  memoryWritten(missionId: string, record: MemoryRecord): Promise<void> {
    return this.publish(MemoryWritten, { missionId, record });
  }

  private publish<T>(definition: EventDefinition<T>, payload: Omit<T, 'timestamp'>): Promise<void> {
    return this.bus.publish(definition, { ...payload, timestamp: Date.now() } as T);
  }
}
