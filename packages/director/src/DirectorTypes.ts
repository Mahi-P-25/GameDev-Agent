import type { Brand, Json, Timestamp, UUID } from '@gamedev-agent/shared';

export type MissionId = Brand<UUID, 'MissionId'>;
export type GoalId = Brand<UUID, 'GoalId'>;
export type StrategyId = Brand<UUID, 'StrategyId'>;

export type MissionStatus = 'active' | 'completed' | 'archived';
export type GoalStatus = 'draft' | 'clarifying' | 'ready';
export type StrategyStatus =
  | 'formulating'
  | 'ready'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const MISSION_STATUSES: ReadonlyArray<MissionStatus> = ['active', 'completed', 'archived'];
export const GOAL_STATUSES: ReadonlyArray<GoalStatus> = ['draft', 'clarifying', 'ready'];
export const STRATEGY_STATUSES: ReadonlyArray<StrategyStatus> = [
  'formulating',
  'ready',
  'executing',
  'completed',
  'failed',
  'cancelled',
];
export const TERMINAL_STRATEGY_STATUSES: ReadonlyArray<StrategyStatus> = [
  'completed',
  'failed',
  'cancelled',
];

export interface Mission {
  readonly id: MissionId;
  readonly title: string;
  readonly description: string;
  readonly status: MissionStatus;
  readonly goalIds: ReadonlyArray<GoalId>;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface ClarificationRequest {
  readonly id: string;
  readonly question: string;
  readonly answered: boolean;
  readonly answer?: string;
}

export interface Goal {
  readonly id: GoalId;
  readonly missionId: MissionId;
  readonly title: string;
  readonly description: string;
  readonly context: Readonly<Record<string, Json>>;
  readonly status: GoalStatus;
  readonly questions: ReadonlyArray<ClarificationRequest>;
  readonly strategyId: StrategyId | null;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface Milestone {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly requiredCapabilities: ReadonlyArray<string>;
  readonly dependsOn: ReadonlyArray<string>;
}

export interface AgentRequirement {
  readonly role: string;
  readonly capabilities: ReadonlyArray<string>;
  readonly count: number;
}

export interface Dependency {
  readonly from: string;
  readonly to: string;
  readonly type: 'blocks' | 'requires';
}

export interface ExecutionStep {
  readonly milestoneId: string;
  readonly agentRole: string;
  readonly order: number;
}

export interface ExecutionOrder {
  readonly steps: ReadonlyArray<ExecutionStep>;
}

export type DecisionType =
  | 'milestone'
  | 'agent'
  | 'dependency'
  | 'order'
  | 'confidence'
  | 'retry'
  | 'cancel'
  | 'other';

export interface DecisionEntry {
  readonly id: string;
  readonly timestamp: Timestamp;
  readonly type: DecisionType;
  readonly description: string;
  readonly rationale: string;
  readonly metadata?: Readonly<Record<string, Json>>;
}

export interface Strategy {
  readonly id: StrategyId;
  readonly goalId: GoalId;
  readonly status: StrategyStatus;
  readonly milestones: ReadonlyArray<Milestone>;
  readonly agents: ReadonlyArray<AgentRequirement>;
  readonly dependencies: ReadonlyArray<Dependency>;
  readonly order: ExecutionOrder;
  readonly decisionLog: ReadonlyArray<DecisionEntry>;
  readonly confidence: number;
  readonly directorName: string;
  readonly failureReason: string | null;
  readonly retryCount: number;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface StrategyBlueprint {
  readonly milestones: ReadonlyArray<Milestone>;
  readonly agents: ReadonlyArray<AgentRequirement>;
  readonly dependencies: ReadonlyArray<Dependency>;
  readonly order: ExecutionOrder;
  readonly decisionLog: ReadonlyArray<DecisionEntry>;
  readonly confidence: number;
}

export interface MissionRequest {
  readonly title: string;
  readonly description: string;
  readonly context?: Readonly<Record<string, Json>>;
}

export interface GoalRequest {
  readonly missionId: MissionId;
  readonly title: string;
  readonly description: string;
  readonly context?: Readonly<Record<string, Json>>;
}

export interface ClarificationAnswers {
  readonly goalId: GoalId;
  readonly answers: ReadonlyArray<{
    readonly questionId: string;
    readonly answer: string;
  }>;
}
