import type { MissionId } from '@gamedev-agent/coordinator';
import type { GoalId } from '@gamedev-agent/producer';
import type { ProjectId } from '@gamedev-agent/project';
import type { Brand, Timestamp, UUID } from '@gamedev-agent/shared';
import type { WorkflowExecutionId, WorkflowId } from '@gamedev-agent/workflow';
import type { WorkspaceId } from '@gamedev-agent/workspace';

/**
 * The Context Engine — the living memory of *what the Creative Director is doing
 * right now*.
 *
 * Nova should never again ask "which project is this for?" on every action.
 * The Context Engine holds the single, authoritative snapshot of the active
 * development surface — the current workspace, project, goal, mission, workflow,
 * active file, branch, and the recent files / workflows the Director has been
 * touching — and publishes a typed event every time any of it changes. It
 * consumes only the Workspace, Projects, Producer, Coordinator, and Workflow
 * subsystems; it holds no AI, memory, or knowledge of its own.
 */

/** Branded context identifier. Plain string at runtime, distinct at the type level. */
export type ContextId = Brand<UUID, 'ContextId'>;

/** A filesystem path the Creative Director is actively editing. */
export type AbsolutePath = Brand<string, 'AbsolutePath'>;

/**
 * A Git branch name. A "future seam": the value is captured and tracked today so
 * that, when the Version-Control subsystem lands, context can react to branch
 * switches without a contract change. Always present but may be `null` when no
 * repository is detected.
 */
export type BranchName = Brand<string, 'BranchName'>;

/**
 * The complete, immutable-at-rest Current Context aggregate. A single instance
 * exists for the running studio session (the "current" context). Instances are
 * produced by {@link ContextFactory} and mutated only through the
 * {@link ContextManager} (which returns new, validated instances — never
 * mutates in place). `null` fields mean "not yet known".
 */
export interface CurrentContext {
  /** Stable id of this context object (always the same singleton instance). */
  readonly id: ContextId;
  /** The currently selected workspace, or `null` when none is active. */
  readonly workspaceId: WorkspaceId | null;
  /** The currently active project, or `null` when none is active. */
  readonly projectId: ProjectId | null;
  /** The Creative Director's current goal, or `null` when none is active. */
  readonly goalId: GoalId | null;
  /** The mission currently being worked, or `null` when none is active. */
  readonly missionId: MissionId | null;
  /** The workflow definition currently selected, or `null` when none is selected. */
  readonly workflowId: WorkflowId | null;
  /** The workflow execution currently running, or `null` when none is running. */
  readonly workflowExecutionId: WorkflowExecutionId | null;
  /** The file the Director is actively editing, or `null` when none is focused. */
  readonly activeFile: AbsolutePath | null;
  /** The Git branch of the active project, or `null` when undetected. */
  readonly branch: BranchName | null;
  /** Most-recently-touched files, newest first (bounded ring). */
  readonly recentFiles: ReadonlyArray<AbsolutePath>;
  /** Most-recently-used workflows, newest first (bounded ring). */
  readonly recentWorkflows: ReadonlyArray<WorkflowId>;
  /** Event time the context was last mutated. */
  readonly updatedAt: Timestamp;
}

/**
 * Input for establishing the initial context. Almost everything is optional:
 * the Creative Director may open Nova with nothing selected (onboarding state)
 * or with a deep-linked project/goal.
 */
export interface ContextInit {
  readonly workspaceId?: WorkspaceId | null;
  readonly projectId?: ProjectId | null;
  readonly goalId?: GoalId | null;
  readonly missionId?: MissionId | null;
  readonly workflowId?: WorkflowId | null;
  readonly workflowExecutionId?: WorkflowExecutionId | null;
  readonly activeFile?: AbsolutePath | null;
  readonly branch?: BranchName | null;
  readonly recentFiles?: ReadonlyArray<AbsolutePath>;
  readonly recentWorkflows?: ReadonlyArray<WorkflowId>;
}

/**
 * A partial mutation of the context. Every field is optional; only the supplied
 * fields change. The id and `updatedAt` are managed by the manager and cannot be
 * patched directly.
 */
export interface ContextPatch {
  readonly workspaceId?: WorkspaceId | null;
  readonly projectId?: ProjectId | null;
  readonly goalId?: GoalId | null;
  readonly missionId?: MissionId | null;
  readonly workflowId?: WorkflowId | null;
  readonly workflowExecutionId?: WorkflowExecutionId | null;
  readonly activeFile?: AbsolutePath | null;
  readonly branch?: BranchName | null;
}

/** Maximum number of recent files retained in the context ring. */
export const RECENT_FILES_LIMIT = 25;

/** Maximum number of recent workflows retained in the context ring. */
export const RECENT_WORKFLOWS_LIMIT = 15;

/**
 * Re-exported cross-package identifier types so consumers can reference them
 * from a single import.
 */
export type { ProjectId, WorkspaceId, MissionId, GoalId, WorkflowId, WorkflowExecutionId };
