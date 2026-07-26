import type { EventDefinition } from '@gamedev-agent/events';
import type { ProjectId } from '@gamedev-agent/project';
import type { WorkspaceId, WorkspaceStatus } from './WorkspaceTypes';

/**
 * Strongly-typed event catalog for the Nova Workspace System.
 *
 * Every event is an {@link EventDefinition} (stable `type` + `version`), exactly
 * like the kernel/project catalogs in `@gamedev-agent/events`. Subscribers bind
 * to the definition, not a magic string, so payloads are fully inferred and the
 * compiler catches drift. The Workspace System publishes these through the shared
 * Event Bus — it never calls other packages directly.
 *
 * Naming follows the Nova convention: `<aggregate>.<pastTenseVerb>`
 * (e.g. `workspace.created`). `version: 1` leaves room for payload evolution.
 */

/** Emitted when a workspace is created. */
export interface WorkspaceCreatedPayload {
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly status: WorkspaceStatus;
  readonly projectCount: number;
  readonly timestamp: number;
}

/** Emitted when a workspace is opened (loaded into the active session). */
export interface WorkspaceOpenedPayload {
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly timestamp: number;
}

/** Emitted when an open workspace is closed. */
export interface WorkspaceClosedPayload {
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly timestamp: number;
}

/** Emitted when a workspace is renamed. */
export interface WorkspaceRenamedPayload {
  readonly workspaceId: WorkspaceId;
  readonly previousName: string;
  readonly name: string;
  readonly timestamp: number;
}

/** Emitted when a workspace is archived. */
export interface WorkspaceArchivedPayload {
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly timestamp: number;
}

/** Emitted when a workspace is deleted. */
export interface WorkspaceDeletedPayload {
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly timestamp: number;
}

/** Emitted when a workspace changes in any (non-lifecycle, non-rename) way. */
export interface WorkspaceUpdatedPayload {
  readonly workspaceId: WorkspaceId;
  /** Fields that changed in this update. */
  readonly changedFields: ReadonlyArray<string>;
  readonly timestamp: number;
}

/** Emitted when a project is added to a workspace (ownership established). */
export interface WorkspaceProjectAddedPayload {
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId;
  readonly timestamp: number;
}

/** Emitted when a project is removed from a workspace (ownership released). */
export interface WorkspaceProjectRemovedPayload {
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId;
  readonly timestamp: number;
}

export const WorkspaceCreated = define<WorkspaceCreatedPayload>('workspace.created');
export const WorkspaceOpened = define<WorkspaceOpenedPayload>('workspace.opened');
export const WorkspaceClosed = define<WorkspaceClosedPayload>('workspace.closed');
export const WorkspaceArchived = define<WorkspaceArchivedPayload>('workspace.archived');
export const WorkspaceDeleted = define<WorkspaceDeletedPayload>('workspace.deleted');
export const WorkspaceRenamed = define<WorkspaceRenamedPayload>('workspace.renamed');
export const WorkspaceUpdated = define<WorkspaceUpdatedPayload>('workspace.updated');
export const WorkspaceProjectAdded = define<WorkspaceProjectAddedPayload>(
  'workspace.project.added',
);
export const WorkspaceProjectRemoved = define<WorkspaceProjectRemovedPayload>(
  'workspace.project.removed',
);

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

/** Convenience union of every workspace event payload, for tooling/subscribers. */
export type WorkspaceEventPayloads =
  | WorkspaceCreatedPayload
  | WorkspaceOpenedPayload
  | WorkspaceClosedPayload
  | WorkspaceArchivedPayload
  | WorkspaceDeletedPayload
  | WorkspaceRenamedPayload
  | WorkspaceUpdatedPayload
  | WorkspaceProjectAddedPayload
  | WorkspaceProjectRemovedPayload;
