import type { EventDefinition } from '@gamedev-agent/events';
import type {
  AgentActivity,
  AgentId,
  AgentStatus,
  Notification,
  Operation,
  OperationId,
  OperationKind,
  TaskId,
  TaskPlanId,
  TaskState,
} from './IntelligenceTypes';

/**
 * Strongly-typed event catalog for the Nova Studio Intelligence layer.
 *
 * Every truthful event the Intelligence layer emits follows the kernel convention
 * `<aggregate>.<pastTenseVerb>` (e.g. `task.succeeded`, `agent.registered`).
 * Subscribers bind to the {@link EventDefinition}, never a magic string, so
 * payloads are fully inferred.
 *
 * Crucially, there is **no** `agent.thinking` / `agent.reasoned` event. Agents
 * only ever appear in events that correspond to a real operation or a real state
 * transition driven by one. The Notification system and Agent Activity model both
 * subscribe to these and never invent anything.
 */

export interface TaskSubmittedPayload {
  readonly taskId: TaskId;
  readonly agentId: AgentId;
  readonly operation: Operation;
  readonly correlationId: string | null;
  readonly timestamp: number;
}

export interface TaskPlannedPayload {
  readonly taskId: TaskId;
  readonly planId: TaskPlanId | null;
  readonly agentId: AgentId;
  readonly timestamp: number;
}

export interface TaskRunningPayload {
  readonly taskId: TaskId;
  readonly agentId: AgentId;
  readonly progress: number;
  readonly timestamp: number;
}

export interface TaskProgressPayload {
  readonly taskId: TaskId;
  readonly agentId: AgentId;
  readonly progress: number;
  readonly timestamp: number;
}

export interface TaskSucceededPayload {
  readonly taskId: TaskId;
  readonly agentId: AgentId;
  readonly correlationId: string | null;
  readonly timestamp: number;
}

export interface TaskFailedPayload {
  readonly taskId: TaskId;
  readonly agentId: AgentId;
  readonly reason: string;
  readonly correlationId: string | null;
  readonly timestamp: number;
}

export interface TaskCanceledPayload {
  readonly taskId: TaskId;
  readonly agentId: AgentId;
  readonly reason: string;
  readonly timestamp: number;
}

export interface TaskBlockedPayload {
  readonly taskId: TaskId;
  readonly agentId: AgentId;
  readonly blockedBy: ReadonlyArray<TaskId>;
  readonly timestamp: number;
}

export interface AgentRegisteredPayload {
  readonly agentId: AgentId;
  readonly kind: string;
  readonly name: string;
  readonly capabilities: ReadonlyArray<string>;
  readonly timestamp: number;
}

export interface AgentUnregisteredPayload {
  readonly agentId: AgentId;
  readonly timestamp: number;
}

export interface AgentStatusChangedPayload {
  readonly agentId: AgentId;
  readonly kind: string;
  readonly from: AgentStatus;
  readonly to: AgentStatus;
  readonly timestamp: number;
}

export interface PlanCreatedPayload {
  readonly planId: TaskPlanId;
  readonly goal: string;
  readonly taskCount: number;
  readonly correlationId: string | null;
  readonly timestamp: number;
}

export interface OperationInvokedPayload {
  readonly operationId: OperationId;
  readonly kind: OperationKind;
  readonly agentId: AgentId;
  readonly taskId: TaskId;
  readonly timestamp: number;
}

export interface NotificationEmittedPayload {
  readonly notification: Notification;
  readonly timestamp: number;
}

export interface AgentActivityRecordedPayload {
  readonly activity: AgentActivity;
  readonly timestamp: number;
}

export const TaskSubmitted = define<TaskSubmittedPayload>('task.submitted');
export const TaskPlanned = define<TaskPlannedPayload>('task.planned');
export const TaskRunning = define<TaskRunningPayload>('task.running');
export const TaskProgress = define<TaskProgressPayload>('task.progress');
export const TaskSucceeded = define<TaskSucceededPayload>('task.succeeded');
export const TaskFailed = define<TaskFailedPayload>('task.failed');
export const TaskCanceled = define<TaskCanceledPayload>('task.canceled');
export const TaskBlocked = define<TaskBlockedPayload>('task.blocked');
export const AgentRegistered = define<AgentRegisteredPayload>('agent.registered');
export const AgentUnregistered = define<AgentUnregisteredPayload>('agent.unregistered');
export const AgentStatusChanged = define<AgentStatusChangedPayload>('agent.status-changed');
export const PlanCreated = define<PlanCreatedPayload>('intelligence.plan-created');
export const OperationInvoked = define<OperationInvokedPayload>('intelligence.operation-invoked');
export const NotificationEmitted = define<NotificationEmittedPayload>('intelligence.notification');
export const AgentActivityRecorded = define<AgentActivityRecordedPayload>(
  'intelligence.agent-activity',
);

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

/** Every intelligence event payload, for consumers that need a union. */
export type IntelligenceEventPayloads =
  | TaskSubmittedPayload
  | TaskPlannedPayload
  | TaskRunningPayload
  | TaskProgressPayload
  | TaskSucceededPayload
  | TaskFailedPayload
  | TaskCanceledPayload
  | TaskBlockedPayload
  | AgentRegisteredPayload
  | AgentUnregisteredPayload
  | AgentStatusChangedPayload
  | PlanCreatedPayload
  | OperationInvokedPayload
  | NotificationEmittedPayload
  | AgentActivityRecordedPayload;

// Re-exported domain entity types for subscribers that want a single import site.
export type { TaskState, OperationKind, AgentStatus, Notification, AgentActivity };
