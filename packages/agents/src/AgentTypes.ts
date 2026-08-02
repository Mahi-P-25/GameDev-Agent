import type { AgentCapability, AgentType } from '@gamedev-agent/agent-runtime';
import type { IMissionMemoryStore, MemoryRecord } from '@gamedev-agent/ami';
import type { Timestamp } from '@gamedev-agent/shared';
import type { MissionAbility } from '@gamedev-agent/tool-runtime';
import type {
  MissionId,
  ProjectId,
  WorkflowExecutionId,
  WorkflowId,
  WorkflowStep,
  WorkflowStepContext,
  WorkflowStepId,
} from '@gamedev-agent/workflow';

/**
 * The closed set of specialist roles the multi-agent studio understands. A
 * step with a `requiredRole` not in this set is treated as "unknown" and falls
 * back to the single-agent {@link MissionAgent} path (see report §7.3).
 */
export type AgentRole =
  | 'planner'
  | 'programmer'
  | 'technical-artist'
  | 'game-designer'
  | 'qa'
  | 'performance';

export const AGENT_ROLES: ReadonlyArray<AgentRole> = [
  'planner',
  'programmer',
  'technical-artist',
  'game-designer',
  'qa',
  'performance',
];

/** Runtime guard for the closed role union. No coercion of the value itself. */
export function isAgentRole(value: string): value is AgentRole {
  return (AGENT_ROLES as readonly string[]).includes(value);
}

/**
 * Per-task lifecycle state for a specialist. This is a deliberately separate
 * closed union — it is NOT execution-engine's `AgentState`, is not kept in
 * sync with it, and drops the single-agent inner-loop phases (`observing`,
 * `thinking`, `deciding`, `awaiting_approval`) that a specialist does not own.
 * Local to `packages/agents` so the package never depends on
 * `packages/execution-engine`.
 */
export type AgentTaskLifecycleState =
  | 'idle'
  | 'running'
  | 'executing'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Branded-string coercion helpers. Each is a runtime no-op that asserts a
 * plain string at a trusted boundary into the matching brand, mirroring the
 * established repo pattern (`asToolId` in tool-runtime, `plan.id as
 * WorkflowStepId` in ami reasoning-loop, `'' as AgentId` in agent-runtime).
 * Safe because the brand is erased at runtime; callers assert provenance.
 */

/** Coerce a role's stable specialist type string into the `AgentType` brand. */
export function asAgentType(value: string): AgentType {
  return value as AgentType;
}

/** Coerce a `MissionAbility` string into the `AgentCapability` brand. */
export function asAgentCapability(value: string): AgentCapability {
  return value as AgentCapability;
}

export function asMissionId(value: string): MissionId {
  return value as MissionId;
}

export function asProjectId(value: string): ProjectId {
  return value as ProjectId;
}

export function asWorkflowId(value: string): WorkflowId {
  return value as WorkflowId;
}

export function asWorkflowExecutionId(value: string): WorkflowExecutionId {
  return value as WorkflowExecutionId;
}

export function asWorkflowStepId(value: string): WorkflowStepId {
  return value as WorkflowStepId;
}

/** The stable, per-role `AgentType` registered for each specialist. */
export function agentTypeForRole(role: AgentRole): AgentType {
  return asAgentType(`agent:${role}`);
}

/**
 * The `MissionAbility` surface each specialist satisfies, v1. These map 1:1
 * onto the registered `AgentCapability`s so the runtime's capability-based
 * dispatch (agent-runtime `findAgentByCapability`) can route to a specialist.
 * Refined per-phase as real tool wiring lands.
 */
const ROLE_ABILITIES: Readonly<Record<AgentRole, readonly MissionAbility[]>> = {
  planner: ['inspect-workspace', 'search-files', 'version-control-status'],
  programmer: [
    'read-files',
    'write-files',
    'edit-files',
    'run-commands',
    'execute-script',
    'install-packages',
    'test-project',
    'build-project',
    'version-control-status',
    'version-control-commit',
  ],
  'technical-artist': [
    'read-files',
    'write-files',
    'edit-files',
    'run-commands',
    'build-project',
    'render-scene',
  ],
  'game-designer': ['read-files', 'write-files', 'edit-files', 'search-files', 'preview-project'],
  qa: ['read-files', 'list-files', 'run-commands', 'test-project', 'build-project'],
  performance: ['read-files', 'list-files', 'run-commands', 'test-project', 'build-project'],
};

/** The registered capabilities a role's specialist advertises. */
export function roleCapabilities(role: AgentRole): ReadonlyArray<AgentCapability> {
  return ROLE_ABILITIES[role].map(asAgentCapability);
}

/** Advertise a single tool ability as an `AgentCapability` (registry boundary). */
export function agentCapabilityFromAbility(ability: MissionAbility): AgentCapability {
  return asAgentCapability(ability);
}

/**
 * A single unit of work handed to a specialist: one workflow step plus the
 * context it ran in, correlated by `taskId`. Published in `mission.agent.assigned`.
 */
export interface AgentTask {
  readonly taskId: string;
  readonly missionId: string;
  readonly projectId: ProjectId;
  readonly role: AgentRole;
  readonly step: WorkflowStep;
  readonly context: WorkflowStepContext;
  readonly goalNodeId?: string;
}

/**
 * A specialist's task outcome is the `mission.agent.result` event payload
 * (`AgentResultPayload` in AgentEvents) — one source of truth, no parallel
 * domain type.
 */

/**
 * The mission-scoped context assembled for a specialist before it executes its
 * task: the task itself plus a distilled view of prior mission memory so a
 * specialist can build on what earlier specialists already learned.
 */
export interface AgentMissionContext {
  readonly missionId: string;
  readonly projectId: ProjectId;
  readonly task: AgentTask;
  readonly memorySummary: string;
  readonly priorFailures: ReadonlyArray<MemoryRecord>;
  readonly goalNodeId?: string;
  readonly assembledAt: Timestamp;
}

export interface AssembleAgentContextOptions {
  readonly memory: IMissionMemoryStore;
  readonly task: AgentTask;
  /** How many prior `failure` records to surface. Default 5. */
  readonly failureLimit?: number;
}

/** Assemble a specialist's mission context from the mission memory store. */
export async function assembleAgentContext(
  options: AssembleAgentContextOptions,
): Promise<AgentMissionContext> {
  const failureLimit = options.failureLimit ?? 5;
  const [memorySummary, priorFailures] = await Promise.all([
    options.memory.summarize(options.task.missionId),
    options.memory.query({
      missionId: options.task.missionId,
      kind: 'failure',
      limit: failureLimit,
    }),
  ]);
  return {
    missionId: options.task.missionId,
    projectId: options.task.projectId,
    task: options.task,
    memorySummary,
    priorFailures,
    ...(options.task.goalNodeId !== undefined ? { goalNodeId: options.task.goalNodeId } : {}),
    assembledAt: Date.now() as Timestamp,
  };
}

/** Final outcome of a multi-agent mission orchestration pass. */
export interface OrchestratorOutcome {
  readonly missionId: string;
  readonly status: 'completed' | 'failed' | 'cancelled';
  readonly summary: string;
  readonly actionCount: number;
  readonly failureCount: number;
  readonly totalDurationMs: number;
}
