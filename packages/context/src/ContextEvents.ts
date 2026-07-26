import type { MissionId } from '@gamedev-agent/coordinator';
import type { EventDefinition } from '@gamedev-agent/events';
import type { GoalId } from '@gamedev-agent/producer';
import type { WorkspaceId } from '@gamedev-agent/workspace';
import type {
  AbsolutePath,
  BranchName,
  ContextId,
  CurrentContext,
  ProjectId,
  WorkflowExecutionId,
  WorkflowId,
} from './ContextTypes';

/**
 * Strongly-typed event catalog for the Nova Context Engine.
 *
 * Every context change emits a typed {@link EventDefinition} (stable `type` +
 * `version: 1`), following the Nova convention `<aggregate>.<pastTenseVerb>`
 * (e.g. `context.project.changed`). Subscribers bind to the definition, not a
 * magic string, so payloads are fully inferred and the compiler catches drift.
 *
 * The Context Engine also publishes a single {@link ContextChanged} snapshot
 * event whenever *any* field changes, so consumers that only care about "the
 * context moved" can subscribe to one definition instead of six.
 */

/** Emitted when the whole context is (re)established, typically at boot. */
export interface ContextInitializedPayload {
  readonly contextId: ContextId;
  readonly hasProject: boolean;
  readonly hasWorkspace: boolean;
  readonly timestamp: number;
}

/** Emitted when the active workspace changes. */
export interface ContextWorkspaceChangedPayload {
  readonly contextId: ContextId;
  readonly previousWorkspaceId: WorkspaceId | null;
  readonly workspaceId: WorkspaceId | null;
  readonly timestamp: number;
}

/** Emitted when the active project changes. */
export interface ContextProjectChangedPayload {
  readonly contextId: ContextId;
  readonly previousProjectId: ProjectId | null;
  readonly projectId: ProjectId | null;
  readonly timestamp: number;
}

/** Emitted when the current goal changes. */
export interface ContextGoalChangedPayload {
  readonly contextId: ContextId;
  readonly previousGoalId: GoalId | null;
  readonly goalId: GoalId | null;
  readonly timestamp: number;
}

/** Emitted when the current mission changes. */
export interface ContextMissionChangedPayload {
  readonly contextId: ContextId;
  readonly previousMissionId: MissionId | null;
  readonly missionId: MissionId | null;
  readonly timestamp: number;
}

/** Emitted when the selected/active workflow changes. */
export interface ContextWorkflowChangedPayload {
  readonly contextId: ContextId;
  readonly previousWorkflowId: WorkflowId | null;
  readonly workflowId: WorkflowId | null;
  readonly timestamp: number;
}

/** Emitted when the active file changes. */
export interface ContextActiveFileChangedPayload {
  readonly contextId: ContextId;
  readonly previousActiveFile: AbsolutePath | null;
  readonly activeFile: AbsolutePath | null;
  readonly timestamp: number;
}

/** Emitted when the Git branch of the active project changes (future seam). */
export interface ContextBranchChangedPayload {
  readonly contextId: ContextId;
  readonly previousBranch: BranchName | null;
  readonly branch: BranchName | null;
  readonly timestamp: number;
}

/** Emitted when a file is touched and added to recent files. */
export interface ContextRecentFileAddedPayload {
  readonly contextId: ContextId;
  readonly file: AbsolutePath;
  readonly recentFiles: ReadonlyArray<AbsolutePath>;
  readonly timestamp: number;
}

/** Emitted when a workflow is used and added to recent workflows. */
export interface ContextRecentWorkflowAddedPayload {
  readonly contextId: ContextId;
  readonly workflowId: WorkflowId;
  readonly recentWorkflows: ReadonlyArray<WorkflowId>;
  readonly timestamp: number;
}

/** Emitted whenever the context is reset to the onboarding (empty) state. */
export interface ContextResetPayload {
  readonly contextId: ContextId;
  readonly timestamp: number;
}

/** A full snapshot after any change — the single event busy consumers watch. */
export interface ContextChangedPayload {
  /** Which top-level field(s) changed in this mutation. */
  readonly changedFields: ReadonlyArray<string>;
  /** The complete, current snapshot. */
  readonly context: CurrentContext;
  readonly timestamp: number;
}

export const ContextInitialized = define<ContextInitializedPayload>('context.initialized');
export const ContextWorkspaceChanged = define<ContextWorkspaceChangedPayload>(
  'context.workspace.changed',
);
export const ContextProjectChanged =
  define<ContextProjectChangedPayload>('context.project.changed');
export const ContextGoalChanged = define<ContextGoalChangedPayload>('context.goal.changed');
export const ContextMissionChanged =
  define<ContextMissionChangedPayload>('context.mission.changed');
export const ContextWorkflowChanged = define<ContextWorkflowChangedPayload>(
  'context.workflow.changed',
);
export const ContextActiveFileChanged = define<ContextActiveFileChangedPayload>(
  'context.active-file.changed',
);
export const ContextBranchChanged = define<ContextBranchChangedPayload>('context.branch.changed');
export const ContextRecentFileAdded = define<ContextRecentFileAddedPayload>(
  'context.recent-file.added',
);
export const ContextRecentWorkflowAdded = define<ContextRecentWorkflowAddedPayload>(
  'context.recent-workflow.added',
);
export const ContextReset = define<ContextResetPayload>('context.reset');
export const ContextChanged = define<ContextChangedPayload>('context.changed');

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

/** All context event payloads, for consumers that need a union. */
export type ContextEventPayloads =
  | ContextInitializedPayload
  | ContextWorkspaceChangedPayload
  | ContextProjectChangedPayload
  | ContextGoalChangedPayload
  | ContextMissionChangedPayload
  | ContextWorkflowChangedPayload
  | ContextActiveFileChangedPayload
  | ContextBranchChangedPayload
  | ContextRecentFileAddedPayload
  | ContextRecentWorkflowAddedPayload
  | ContextResetPayload
  | ContextChangedPayload;

/** Re-exported for subscribers that wish to type a handler against the entity. */
export type { CurrentContext, WorkflowExecutionId };
