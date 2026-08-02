import type { EventDefinition } from '@gamedev-agent/events';
import type { WorkflowStep, WorkflowStepContext } from '@gamedev-agent/workflow';
import type { AgentRole, AgentTaskLifecycleState } from './AgentTypes';

/**
 * Defines a typed bus event under the `mission.agent.*` namespace. Version 1
 * catalogs are immutable; payload evolution bumps the version (report §7.4).
 */
function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

/**
 * A step has been dispatched to a specialist. Published by the task bridge
 * (AgentTaskExecutor) immediately before it waits for the specialist's result.
 * The only bridge-to-specialist assignment signal — specialists never receive
 * orchestration through direct method calls or `AgentRuntime.request` (report
 * §7.2). `agentId` is the stable per-role specialist identity (`agent:<role>`);
 * a live spawned instance id may replace it once instances run (Phase 3+).
 */
export interface AgentAssignedPayload {
  readonly missionId: string;
  readonly projectId: string;
  readonly agentId: string;
  readonly role: AgentRole;
  readonly taskId: string;
  readonly step: WorkflowStep;
  readonly context: WorkflowStepContext;
  readonly goalNodeId?: string;
  readonly timestamp: number;
}

export const AgentAssigned = define<AgentAssignedPayload>('mission.agent.assigned');

/** A specialist has begun executing its task. */
export interface AgentTaskStartedPayload {
  readonly missionId: string;
  readonly taskId: string;
  readonly agentId: string;
  readonly role: AgentRole;
  readonly startedAt: number;
}

export const AgentTaskStarted = define<AgentTaskStartedPayload>('mission.agent.task-started');

/** A specialist's mission-scoped state machine transitioned. */
export interface AgentStateChangedPayload {
  readonly missionId: string;
  readonly agentId: string;
  readonly role: AgentRole;
  readonly from: AgentTaskLifecycleState;
  readonly to: AgentTaskLifecycleState;
  readonly timestamp: number;
}

export const AgentStateChanged = define<AgentStateChangedPayload>('mission.agent.state-changed');

/** Progress heartbeat from a working specialist. */
export interface AgentProgressPayload {
  readonly missionId: string;
  readonly taskId: string;
  readonly agentId: string;
  readonly percent: number;
  readonly message: string;
  readonly timestamp: number;
}

export const AgentProgress = define<AgentProgressPayload>('mission.agent.progress');

/** A specialist's final verdict for one task. Correlated with its taskId. */
export interface AgentResultPayload {
  readonly missionId: string;
  readonly taskId: string;
  readonly agentId: string;
  readonly ok: boolean;
  readonly summary: string;
  readonly error?: string;
  readonly artifacts: ReadonlyArray<string>;
  readonly completedAt: number;
}

export const AgentResult = define<AgentResultPayload>('mission.agent.result');

/** A specialist finished its task successfully. */
export interface AgentCompletedPayload {
  readonly missionId: string;
  readonly taskId: string;
  readonly agentId: string;
  readonly summary: string;
  readonly artifacts: ReadonlyArray<string>;
  readonly completedAt: number;
}

export const AgentCompleted = define<AgentCompletedPayload>('mission.agent.completed');

/** A specialist failed its task. */
export interface AgentFailedPayload {
  readonly missionId: string;
  readonly taskId: string;
  readonly agentId: string;
  readonly reason: string;
  readonly failedAt: number;
}

export const AgentFailed = define<AgentFailedPayload>('mission.agent.failed');

/** A mission orchestration pass completed successfully (published by the orchestrator). */
export interface AgentMissionCompletedPayload {
  readonly missionId: string;
  readonly agentId: string;
  readonly summary: string;
  readonly actionCount: number;
  readonly totalDurationMs: number;
  readonly completedAt: number;
}

export const AgentMissionCompleted = define<AgentMissionCompletedPayload>(
  'mission.agent.mission-completed',
);

/** A mission orchestration pass failed or was cancelled. */
export interface AgentMissionFailedPayload {
  readonly missionId: string;
  readonly agentId: string;
  readonly reason: string;
  readonly failureCount: number;
  readonly totalDurationMs: number;
  readonly failedAt: number;
}

export const AgentMissionFailed = define<AgentMissionFailedPayload>('mission.agent.mission-failed');

/**
 * The full, ordered `mission.agent.*` catalog — nine definitions. Never
 * overlaps the single-agent `agent.*` vocabulary owned by execution-engine's
 * MissionAgentEvents (report §7.4).
 */
export const AgentEventCatalog = [
  AgentAssigned,
  AgentTaskStarted,
  AgentStateChanged,
  AgentProgress,
  AgentResult,
  AgentCompleted,
  AgentFailed,
  AgentMissionCompleted,
  AgentMissionFailed,
] as const;

/** Union of every `mission.agent.*` payload, for generic handlers. */
export type AgentEventPayloads =
  | AgentAssignedPayload
  | AgentTaskStartedPayload
  | AgentStateChangedPayload
  | AgentProgressPayload
  | AgentResultPayload
  | AgentCompletedPayload
  | AgentFailedPayload
  | AgentMissionCompletedPayload
  | AgentMissionFailedPayload;
