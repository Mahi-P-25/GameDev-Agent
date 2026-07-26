import type { EventDefinition } from '@gamedev-agent/events';
import type { GoalId, MissionId, StrategyId } from './DirectorTypes';

export interface MissionCreatedPayload {
  readonly missionId: MissionId;
  readonly title: string;
  readonly timestamp: number;
}

export interface GoalSubmittedPayload {
  readonly goalId: GoalId;
  readonly missionId: MissionId;
  readonly title: string;
  readonly timestamp: number;
}

export interface ClarificationRequestedPayload {
  readonly goalId: GoalId;
  readonly questions: ReadonlyArray<{ readonly id: string; readonly question: string }>;
  readonly timestamp: number;
}

export interface ClarificationProvidedPayload {
  readonly goalId: GoalId;
  readonly answers: ReadonlyArray<{ readonly questionId: string; readonly answer: string }>;
  readonly timestamp: number;
}

export interface StrategyFormulatedPayload {
  readonly strategyId: StrategyId;
  readonly goalId: GoalId;
  readonly milestoneCount: number;
  readonly confidence: number;
  readonly directorName: string;
  readonly timestamp: number;
}

export interface StrategyReadyPayload {
  readonly strategyId: StrategyId;
  readonly goalId: GoalId;
  readonly timestamp: number;
}

export interface ExecutionStartedPayload {
  readonly strategyId: StrategyId;
  readonly goalId: GoalId;
  readonly timestamp: number;
}

export interface MilestoneCompletedPayload {
  readonly strategyId: StrategyId;
  readonly milestoneId: string;
  readonly timestamp: number;
}

export interface StrategyCompletedPayload {
  readonly strategyId: StrategyId;
  readonly goalId: GoalId;
  readonly timestamp: number;
}

export interface StrategyFailedPayload {
  readonly strategyId: StrategyId;
  readonly goalId: GoalId;
  readonly reason: string;
  readonly timestamp: number;
}

export interface StrategyRetriedPayload {
  readonly strategyId: StrategyId;
  readonly goalId: GoalId;
  readonly retryCount: number;
  readonly timestamp: number;
}

export interface StrategyCancelledPayload {
  readonly strategyId: StrategyId;
  readonly goalId: GoalId;
  readonly reason: string;
  readonly timestamp: number;
}

export const MissionCreated = define<MissionCreatedPayload>('director.mission-created');
export const GoalSubmitted = define<GoalSubmittedPayload>('director.goal-submitted');
export const ClarificationRequested = define<ClarificationRequestedPayload>(
  'director.clarification-requested',
);
export const ClarificationProvided = define<ClarificationProvidedPayload>(
  'director.clarification-provided',
);
export const StrategyFormulated = define<StrategyFormulatedPayload>('director.strategy-formulated');
export const StrategyReady = define<StrategyReadyPayload>('director.strategy-ready');
export const ExecutionStarted = define<ExecutionStartedPayload>('director.execution-started');
export const MilestoneCompleted = define<MilestoneCompletedPayload>('director.milestone-completed');
export const StrategyCompleted = define<StrategyCompletedPayload>('director.strategy-completed');
export const StrategyFailed = define<StrategyFailedPayload>('director.strategy-failed');
export const StrategyRetried = define<StrategyRetriedPayload>('director.strategy-retried');
export const StrategyCancelled = define<StrategyCancelledPayload>('director.strategy-cancelled');

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

export type DirectorEventPayloads =
  | MissionCreatedPayload
  | GoalSubmittedPayload
  | ClarificationRequestedPayload
  | ClarificationProvidedPayload
  | StrategyFormulatedPayload
  | StrategyReadyPayload
  | ExecutionStartedPayload
  | MilestoneCompletedPayload
  | StrategyCompletedPayload
  | StrategyFailedPayload
  | StrategyRetriedPayload
  | StrategyCancelledPayload;
