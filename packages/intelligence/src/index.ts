/**
 * Nova Studio Intelligence — public surface.
 * ===========================================================================
 *
 * The Studio Intelligence layer sits *behind* Nova: it turns high-level goals into
 * agent-assigned, executable Tasks, runs them through real operations, and reports
 * only truthful activity and notifications.
 *
 * What you get:
 *  - {@link Intelligence}            — the composed facade (agents + tasks + planning
 *                                      + notifications + activity) over the bus.
 *  - {@link AgentRegistry}          — hosts multiple specialized agents.
 *  - {@link TaskEngine}             — long-running tasks mapped to real operations.
 *  - {@link PlanningEngine}         — goals -> executable, agent-assigned TaskPlans.
 *  - {@link NotificationCenter}     — truthful notifications for done/failed/approval.
 *  - {@link AgentActivityLog}       — truthful, append-only agent activity.
 *  - {@link intelligenceModule}     — the Kernel module that installs the layer.
 *  - Types & events                 — the stable contracts integrations build against.
 *
 * Constraints honored by design:
 *  - No fake AI thinking: agents are hosts for real {@link OperationRunner}s; tasks
 *    advance only from real operation callbacks.
 *  - Every agent action maps to a real operation (workflow, git, terminal, build,
 *    claude-code, opencode) declared in {@link OperationKind}.
 */

export { Intelligence } from './Intelligence';
export type { IntelligenceOptions, OperationRunner } from './Intelligence';

export { AgentRegistry } from './AgentRegistry';
export type { AgentRegistryOptions } from './AgentRegistry';

export { TaskEngine } from './TaskEngine';
export type { TaskEngineOptions } from './TaskEngine';

export { PlanningEngine } from './PlanningEngine';
export type { PlanningEngineOptions, GoalStep, PlanGoalRequest } from './PlanningEngine';

export { NotificationCenter, AgentActivityLog, bindAgentRegistry } from './NotificationCenter';
export type { NotificationCenterOptions, AgentActivityLogOptions } from './NotificationCenter';

export {
  intelligenceModule,
  AGENT_REGISTRY_TOKEN,
  TASK_ENGINE_TOKEN,
  PLANNING_ENGINE_TOKEN,
  NOTIFICATION_CENTER_TOKEN,
  AGENT_ACTIVITY_TOKEN,
} from './IntelligenceModule';
export { DEFAULT_AGENTS, seedDefaultAgents } from './Agents';

export {
  TaskSubmitted,
  TaskPlanned,
  TaskRunning,
  TaskProgress,
  TaskSucceeded,
  TaskFailed,
  TaskCanceled,
  TaskBlocked,
  AgentRegistered,
  AgentUnregistered,
  AgentStatusChanged,
  PlanCreated,
  OperationInvoked,
  NotificationEmitted,
  AgentActivityRecorded,
} from './IntelligenceEvents';

export type {
  TaskId,
  AgentId,
  TaskPlanId,
  OperationId,
  NotificationId,
  TaskState,
  Task,
  Agent,
  AgentStatus,
  Operation,
  OperationKind,
  TaskPlan,
  AgentActivity,
  Notification,
  NotificationKind,
} from './IntelligenceTypes';
