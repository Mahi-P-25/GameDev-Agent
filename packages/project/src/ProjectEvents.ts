import type { EventDefinition } from '@gamedev-agent/events';
import type {
  Engine,
  KnowledgeNamespace,
  MemoryNamespace,
  MissionNamespace,
  Project,
  ProjectId,
  ProjectStatus,
} from './ProjectTypes';

/**
 * Strongly-typed event catalog for the Nova Project System.
 *
 * Every event is an {@link EventDefinition} (stable `type` + `version`), exactly
 * like the kernel/mission catalogs in `@gamedev-agent/events`. Subscribers bind
 * to the definition, not a magic string, so payloads are fully inferred and the
 * compiler catches drift. The Project System publishes these through the shared
 * Event Bus — it never calls other packages directly.
 *
 * Naming follows the Nova convention: `<aggregate>.<pastTenseVerb>`
 * (e.g. `project.created`). `version: 1` leaves room for payload evolution.
 */

/** Emitted when a project is created. */
export interface ProjectCreatedPayload {
  readonly projectId: ProjectId;
  readonly name: string;
  readonly rootPath: string;
  readonly engine: Engine;
  readonly status: ProjectStatus;
  readonly memoryNamespace: MemoryNamespace;
  readonly knowledgeNamespace: KnowledgeNamespace;
  readonly missionNamespace: MissionNamespace;
  readonly timestamp: number;
}

/** Emitted when a project is opened (loaded into the active session). */
export interface ProjectOpenedPayload {
  readonly projectId: ProjectId;
  readonly name: string;
  readonly timestamp: number;
}

/** Emitted when an open project is closed. */
export interface ProjectClosedPayload {
  readonly projectId: ProjectId;
  readonly name: string;
  readonly timestamp: number;
}

/** Emitted when a project is renamed. */
export interface ProjectRenamedPayload {
  readonly projectId: ProjectId;
  readonly previousName: string;
  readonly name: string;
  readonly timestamp: number;
}

/** Emitted when a project is updated (any field change). */
export interface ProjectUpdatedPayload {
  readonly projectId: ProjectId;
  /** Fields that changed in this update. */
  readonly changedFields: ReadonlyArray<string>;
  readonly timestamp: number;
}

/** Emitted when a project is deleted. */
export interface ProjectDeletedPayload {
  readonly projectId: ProjectId;
  readonly name: string;
  readonly rootPath: string;
  readonly timestamp: number;
}

export const ProjectCreated = define<ProjectCreatedPayload>('project.created');
export const ProjectOpened = define<ProjectOpenedPayload>('project.opened');
export const ProjectClosed = define<ProjectClosedPayload>('project.closed');
export const ProjectRenamed = define<ProjectRenamedPayload>('project.renamed');
export const ProjectUpdated = define<ProjectUpdatedPayload>('project.updated');
export const ProjectDeleted = define<ProjectDeletedPayload>('project.deleted');

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

/**
 * Convenience: the full project snapshot for listeners that need the complete
 * entity (e.g. a persistence adapter reacting to `project.updated`).
 */
export type ProjectEventPayloads =
  | ProjectCreatedPayload
  | ProjectOpenedPayload
  | ProjectClosedPayload
  | ProjectRenamedPayload
  | ProjectUpdatedPayload
  | ProjectDeletedPayload;

/** Re-exported for subscribers that wish to type a handler against the entity. */
export type { Project };
