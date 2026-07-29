import type { Json, Timestamp } from '@gamedev-agent/shared';
import type { ResolvedCapability, MissionAbility } from '@gamedev-agent/tool-runtime';
import type { WorkflowSource } from '@gamedev-agent/workflow';

/** Agent lifecycle state machine. */
export type AgentState =
  | 'idle'
  | 'running'
  | 'observing'
  | 'thinking'
  | 'deciding'
  | 'executing'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'awaiting_approval';

/** A decision the agent makes about what to do next. */
export type AgentDecision =
  | { type: 'continue'; capability: MissionAbility; params: Readonly<Record<string, Json>>; expected: string }
  | { type: 'retry'; reason: string }
  | { type: 'skip'; reason: string }
  | { type: 'abort'; reason: string }
  | { type: 'request_approval'; question: string; context: string }
  | { type: 'complete' }
  | { type: 'think_deeper'; reasoning: string };

/** An observation the agent gathers from the environment. */
export interface AgentObservation {
  readonly timestamp: number;
  readonly kind: 'project' | 'filesystem' | 'terminal' | 'git' | 'execution_result' | 'thought' | 'system';
  readonly content: string;
  readonly data?: Json;
}

/** The agent's reasoning at a given step. */
export interface AgentThought {
  readonly timestamp: number;
  readonly reasoning: string;
  readonly intention: string;
}

/** A single action the agent executed. */
export interface AgentAction {
  readonly timestamp: number;
  readonly decision: AgentDecision;
  readonly resolvedCapability: ResolvedCapability | null;
  readonly input: Json;
  readonly output: Json | null;
  readonly ok: boolean;
  readonly durationMs: number;
  readonly error?: string | undefined;
}

/** Verification result for an action. */
export interface AgentVerification {
  readonly timestamp: number;
  readonly expected: string;
  readonly observed: string;
  readonly passed: boolean;
  readonly details?: string | undefined;
}

/** Short-term mission memory — lives only for the duration of one mission. */
export interface ShortTermMemory {
  readonly source: WorkflowSource;
  readonly missionId: string | null;
  readonly projectId: string;
  readonly goalTitle: string;
  readonly startedAt: number;
  readonly actions: AgentAction[];
  readonly observations: AgentObservation[];
  readonly thoughts: AgentThought[];
  readonly verifications: AgentVerification[];
  readonly decisions: AgentDecision[];
  readonly failures: Array<{ action: string; reason: string; recovered: boolean }>;
  readonly artifacts: string[];
  readonly openSessions: string[];
  currentState: AgentState;
}

/** Final report generated when the mission ends. */
export interface MissionReport {
  readonly missionId: string;
  readonly planId: string;
  readonly goalTitle: string;
  readonly startedAt: Timestamp;
  readonly completedAt: Timestamp;
  readonly status: 'completed' | 'failed' | 'cancelled';
  readonly finalSummary: string;
  readonly timeline: ReadonlyArray<{ timestamp: number; state: string; summary: string }>;
  readonly actionCount: number;
  readonly failureCount: number;
  readonly artifacts: ReadonlyArray<string>;
  readonly totalDurationMs: number;
  readonly decisionCount: number;
}

/** Options for constructing a MissionAgent. */
export interface MissionAgentOptions {
  readonly toolManager: import('@gamedev-agent/tool-runtime').ToolManager;
  readonly capabilityPlanner?: import('@gamedev-agent/tool-runtime').CapabilityPlanner;
  readonly modelProviders: import('@gamedev-agent/model-providers').ModelProvidersService;
  readonly eventBus: import('@gamedev-agent/events').EventBusContract;
  readonly logger?: import('@gamedev-agent/logging').Logger;
  readonly defaultModel?: string;
  readonly maxRounds?: number;
}
