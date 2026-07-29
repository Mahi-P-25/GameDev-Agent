import type { EventDefinition } from '@gamedev-agent/events';
import type { MissionAbility } from '@gamedev-agent/tool-runtime';
import type { AgentState } from './MissionAgentTypes';

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

// ─── Payloads ──────────────────────────────────────────────────────────────

export interface AgentStateChangedPayload {
  readonly missionId: string;
  readonly planId: string;
  readonly previousState: AgentState;
  readonly currentState: AgentState;
  readonly timestamp: number;
}

export interface AgentThoughtPayload {
  readonly missionId: string;
  readonly reasoning: string;
  readonly intention: string;
  readonly timestamp: number;
}

export interface AgentObservationPayload {
  readonly missionId: string;
  readonly kind: string;
  readonly content: string;
  readonly timestamp: number;
}

export interface AgentDecisionPayload {
  readonly missionId: string;
  readonly decisionType: string;
  readonly capability: MissionAbility | null;
  readonly reasoning: string;
  readonly timestamp: number;
}

export interface AgentActionStartedPayload {
  readonly missionId: string;
  readonly capability: MissionAbility;
  readonly toolId: string;
  readonly action: string;
  readonly input: Record<string, unknown>;
  readonly timestamp: number;
}

export interface AgentActionResultPayload {
  readonly missionId: string;
  readonly capability: MissionAbility;
  readonly ok: boolean;
  readonly durationMs: number;
  readonly output: string;
  readonly error?: string | undefined;
  readonly timestamp: number;
}

export interface AgentVerificationPayload {
  readonly missionId: string;
  readonly expected: string;
  readonly observed: string;
  readonly passed: boolean;
  readonly timestamp: number;
}

export interface AgentProgressPayload {
  readonly missionId: string;
  readonly progress: number;
  readonly actionCount: number;
  readonly failureCount: number;
  readonly timestamp: number;
}

export interface AgentMissionCompletePayload {
  readonly missionId: string;
  readonly status: 'completed' | 'failed' | 'cancelled';
  readonly finalSummary: string;
  readonly actionCount: number;
  readonly totalDurationMs: number;
  readonly timestamp: number;
}

export interface AgentArtifactCreatedPayload {
  readonly missionId: string;
  readonly path: string;
  readonly kind: 'file' | 'directory' | 'dependency' | 'config';
  readonly timestamp: number;
}

// ─── Event Definitions ─────────────────────────────────────────────────────

export const AgentStateChanged = define<AgentStateChangedPayload>('agent.state-changed');
export const AgentThought = define<AgentThoughtPayload>('agent.thought');
export const AgentObservation = define<AgentObservationPayload>('agent.observation');
export const AgentDecisionEvent = define<AgentDecisionPayload>('agent.decision');
export const AgentActionStarted = define<AgentActionStartedPayload>('agent.action-started');
export const AgentActionResult = define<AgentActionResultPayload>('agent.action-result');
export const AgentVerification = define<AgentVerificationPayload>('agent.verification');
export const AgentProgress = define<AgentProgressPayload>('agent.progress');
export const AgentMissionComplete = define<AgentMissionCompletePayload>('agent.mission-complete');
export const AgentArtifactCreated = define<AgentArtifactCreatedPayload>('agent.artifact-created');

export type AgentEventPayloads =
  | AgentStateChangedPayload
  | AgentThoughtPayload
  | AgentObservationPayload
  | AgentDecisionPayload
  | AgentActionStartedPayload
  | AgentActionResultPayload
  | AgentVerificationPayload
  | AgentProgressPayload
  | AgentMissionCompletePayload
  | AgentArtifactCreatedPayload;
