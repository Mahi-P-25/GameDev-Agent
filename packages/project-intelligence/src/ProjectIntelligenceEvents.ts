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

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}
