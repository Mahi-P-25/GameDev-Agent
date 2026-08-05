import type { EventDefinition } from '@gamedev-agent/events';
import type { ProjectId } from '@gamedev-agent/project';

/**
 * Strongly-typed event catalog for the Nova Project Intelligence system.
 *
 * Naming follows the Nova convention: `<aggregate>.<pastTenseVerb>`
 * (e.g. `project-intelligence.indexed`). Subscribers bind to the definition,
 * not a magic string, so payloads are fully inferred.
 */

/** Emitted when a project has been indexed and its metadata cached. */
export interface ProjectIntelligenceIndexedPayload {
  readonly projectId: ProjectId;
  readonly rootPath: string;
  /** The number of files discovered in the project tree. */
  readonly totalFiles: number;
  /** Package managers detected from the project's manifests/lockfiles. */
  readonly packageManagers: readonly string[];
  /** When the index was produced (ms since epoch). */
  readonly timestamp: number;
}

/** Emitted when indexing a project fails (never thrown across the bus). */
export interface ProjectIntelligenceErrorPayload {
  readonly projectId: ProjectId;
  readonly rootPath: string;
  readonly error: string;
  readonly timestamp: number;
}

export const ProjectIntelligenceIndexed = define<ProjectIntelligenceIndexedPayload>(
  'project-intelligence.indexed',
);
export const ProjectIntelligenceError = define<ProjectIntelligenceErrorPayload>(
  'project-intelligence.error',
);

/**
 * Lifecycle events for the index pipeline. These are the events consumers use
 * to observe an index run: `project.index.started` → `project.index.progress`
 * (one or more) → `project.index.completed` | `project.index.failed`.
 */

/** The pipeline stages a scan moves through. */
export type IndexStage = 'scan' | 'folders' | 'dependencies' | 'source' | 'summary';

export interface ProjectIndexStartedPayload {
  readonly projectId: ProjectId;
  readonly rootPath: string;
  /** True when the run is an incremental re-index of a cached project. */
  readonly incremental: boolean;
  readonly timestamp: number;
}

export interface ProjectIndexProgressPayload {
  readonly projectId: ProjectId;
  readonly rootPath: string;
  readonly stage: IndexStage;
  readonly processed: number;
  readonly total: number;
  readonly percent: number;
  readonly timestamp: number;
}

export interface ProjectIndexCompletedPayload {
  readonly projectId: ProjectId;
  readonly rootPath: string;
  readonly totalFiles: number;
  readonly totalDirs: number;
  readonly durationMs: number;
  readonly incremental: boolean;
  /** Number of files added/changed/removed vs. the previous scan. */
  readonly changedFiles: number;
  readonly timestamp: number;
}

export interface ProjectIndexFailedPayload {
  readonly projectId: ProjectId;
  readonly rootPath: string;
  readonly stage: IndexStage;
  readonly error: string;
  readonly timestamp: number;
}

export const ProjectIndexStarted = define<ProjectIndexStartedPayload>('project.index.started');
export const ProjectIndexProgress = define<ProjectIndexProgressPayload>('project.index.progress');
export const ProjectIndexCompleted =
  define<ProjectIndexCompletedPayload>('project.index.completed');
export const ProjectIndexFailed = define<ProjectIndexFailedPayload>('project.index.failed');

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}
