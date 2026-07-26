import type { Brand, Timestamp, UUID } from '@gamedev-agent/shared';

/**
 * Nova Studio Intelligence — domain model.
 * ===========================================================================
 *
 * The Intelligence layer is the orchestration fabric *behind* Nova. It turns a
 * high-level Goal into a concrete, agent-assigned {@link TaskPlan}, runs the
 * resulting {@link Task}s through a registered {@link Agent}, and reports only
 * **truthful** activity derived from real operations (workflow runs, git,
 * terminal, builds, approvals).
 *
 * Hard rules (enforced by design, not just convention):
 *  - No fake AI thinking. An Agent is a *host* for a real operation; a Task is
 *    only ever advanced by a real operation completing, failing, or being
 *    canceled. There is no synthetic "reasoning" or "the agent decided" event.
 *  - Every Agent action maps to a real operation exposed by an {@link Operation}.
 *  - The Notification system only ever echoes real events — it never invents.
 *
 * Branded ids keep the model types distinct at compile time while staying plain
 * strings at runtime (consistent with the rest of the kernel).
 */

/** Branded task identifier. */
export type TaskId = Brand<UUID, 'TaskId'>;
/** Branded agent identifier. */
export type AgentId = Brand<UUID, 'AgentId'>;
/** Branded task-plan identifier. */
export type TaskPlanId = Brand<UUID, 'TaskPlanId'>;
/** Branded operation identifier (a real, callable unit of work). */
export type OperationId = Brand<string, 'OperationId'>;
/** Branded notification identifier. */
export type NotificationId = Brand<UUID, 'NotificationId'>;

/** Lifecycle of a Task. Terminal states are {@link TASK_TERMINAL_STATES}. */
export type TaskState =
  | 'submitted' // created, not yet scheduled
  | 'planned' // assigned to an agent + operation, awaiting run
  | 'running' // the real operation is executing
  | 'succeeded' // the real operation completed successfully
  | 'failed' // the real operation failed (with a real reason)
  | 'canceled' // the Director / system canceled it
  | 'blocked' // waiting on a dependency that has not completed
  | 'waiting'; // queued, an upstream task must finish first

/** Terminal task states (no further transitions). */
export const TASK_TERMINAL_STATES: ReadonlyArray<TaskState> = [
  'succeeded',
  'failed',
  'canceled',
] as const;

/**
 * A real, callable unit of work an Agent can perform. The Intelligence layer
 * never fabricates work — every Task references one of these operations that
 * actually exists in the Studio (workflow run, git command, terminal command,
 * build step). `kind` is the integration seam: today `workflow` is the concrete
 * one wired by the Studio; `git`, `terminal`, and `build` are declared as
 * future seams so integrations slot in without changing the model.
 */
export type OperationKind = 'workflow' | 'git' | 'terminal' | 'build' | 'claude-code' | 'opencode';

export interface Operation {
  readonly id: OperationId;
  readonly kind: OperationKind;
  /** Human-readable name, e.g. "Run validate-project workflow". */
  readonly name: string;
  /**
   * The real target this operation acts on, expressed as free-form params the
   * downstream integration understands (e.g. `{ workflowKind: 'validate-project',
   * projectId }`, `{ command: 'git status' }`). The Intelligence layer does not
   * interpret these — it passes them to the integration when it runs the task.
   */
  readonly params: Readonly<Record<string, unknown>>;
  /** The agent type this operation is authorized for, if any. */
  readonly requiredCapability?: string;
}

/**
 * A specialized agent. Agents are *hosts* for real operations, not autonomous
 * intelligences. Each agent declares the capabilities it can host; the Planning
 * Engine assigns tasks only to agents whose capabilities cover the task's
 * operation. Agents are intentionally inert until given a real task to run.
 */
export interface Agent {
  readonly id: AgentId;
  /** Stable agent kind, e.g. `architect`, `engineer`, `qa`, `builder`. */
  readonly kind: string;
  readonly name: string;
  readonly description: string;
  /** Capabilities this agent can host (matched against {@link Operation.requiredCapability}). */
  readonly capabilities: ReadonlyArray<string>;
  /** Current working state — always derived from real tasks, never invented. */
  readonly status: AgentStatus;
  /** The task this agent is currently running, if any. */
  readonly currentTaskId: TaskId | null;
  readonly registeredAt: Timestamp;
}

/** Live working status of an agent (mirrors the role-status vocabulary). */
export type AgentStatus =
  | 'ready' // available, no task in flight
  | 'working' // actively executing a real operation
  | 'waiting' // blocked on a dependency / approval
  | 'offline'; // not registered / unavailable this session

/**
 * A single unit of long-running studio work. A Task is the Intelligence layer's
 * representation of a real operation in flight. It is immutable once terminal;
 * progress is only ever advanced by a real operation reporting back.
 */
export interface Task {
  readonly id: TaskId;
  readonly planId: TaskPlanId | null;
  readonly title: string;
  readonly description: string;
  readonly state: TaskState;
  /** The agent this task is assigned to (its real host). */
  readonly agentId: AgentId;
  /** The real operation this task executes. */
  readonly operation: Operation;
  /** Task ids that must reach a terminal *success* before this one may run. */
  readonly dependsOn: ReadonlyArray<TaskId>;
  /** 0–100 progress, sourced from real operation telemetry only. */
  readonly progress: number;
  /** Present only when `state` is `failed` — a real failure reason. */
  readonly failureReason: string | null;
  /** Present only when `state` is `canceled` — a real cancellation reason. */
  readonly cancellationReason: string | null;
  /** Arbitrary correlation (goal id, mission id, project id) for traceability. */
  readonly correlationId: string | null;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

/**
 * An executable plan: a goal decomposed into ordered, agent-assigned Tasks. The
 * Planning Engine produces this deterministically from a goal + the registered
 * agents; it performs no execution and no AI inference.
 */
export interface TaskPlan {
  readonly id: TaskPlanId;
  /** The goal/objective this plan realizes (free-form; supplied by the caller). */
  readonly goal: string;
  /** Arbitrary correlation (goal id, mission id, project id). */
  readonly correlationId: string | null;
  /** Ordered tasks (dependency order; parallel-ready tasks adjacent). */
  readonly tasks: ReadonlyArray<Task>;
  /** The strategy that produced this plan (for auditability / future routing). */
  readonly strategy: string;
  readonly createdAt: Timestamp;
}

/**
 * A truthful record of what an agent actually did. These are NOT emitted by an
 * agent "thinking" — they are derived *only* from real Task lifecycle events on
 * the Event Bus. If no real work happened, no activity exists.
 */
export interface AgentActivity {
  readonly id: UUID;
  readonly agentId: AgentId;
  readonly agentKind: string;
  /** The real event that produced this record (e.g. `task.succeeded`). */
  readonly kind: string;
  readonly message: string;
  readonly taskId: TaskId | null;
  readonly timestamp: Timestamp;
}

/** A truthful, user-facing notification produced by the Notification system. */
export interface Notification {
  readonly id: NotificationId;
  /** `success` | `failure` | `approval` | `info` — never synthetic. */
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
  /** The real event that produced this notification. */
  readonly sourceEvent: string;
  readonly correlationId: string | null;
  readonly timestamp: Timestamp;
  readonly read: boolean;
}

/** Notification severity, mapped truthfully from real events. */
export type NotificationKind = 'info' | 'success' | 'failure' | 'approval';
