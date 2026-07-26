import type { Clock, IdGenerator } from '@gamedev-agent/events';
import { SystemClock, UuidGenerator } from '@gamedev-agent/events';
import type { Timestamp, UUID } from '@gamedev-agent/shared';
import { NAMESPACE_SEPARATOR } from '@gamedev-agent/shared';
import { ProjectValidationError } from './ProjectErrors';
import type {
  KnowledgeNamespace,
  MemoryNamespace,
  MissionNamespace,
  Project,
  ProjectId,
  ProjectInit,
  ProjectPatch,
  ProjectStatus,
} from './ProjectTypes';
import { assertValidProject, validateProject, validateProjectFields } from './ProjectValidator';

/**
 * Production clock/id primitives reused from the events package so the Project
 * System shares one source of truth for time and identity with the rest of Nova.
 */
const defaultClock: Clock = SystemClock;
const defaultIds: IdGenerator = UuidGenerator;

/**
 * Constructs {@link Project} aggregates.
 *
 * The factory is the *only* place that assembles a raw {@link Project} object,
 * which keeps construction rules (default values, namespace derivation, id/time
 * stamping, validation) in one testable unit. `Clock` and `IdGenerator` are
 * injected so tests get deterministic ids/timestamps and so the factory never
 * touches `Date.now()` / `crypto` directly (matching the kernel/events pattern).
 *
 * The factory is pure: it neither registers nor emits. Orchestration (events,
 * registry) lives in {@link ProjectManager}.
 */
export interface ProjectFactoryOptions {
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
}

export class ProjectFactory {
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;

  constructor(options: ProjectFactoryOptions = {}) {
    this.clock = options.clock ?? defaultClock;
    this.idGenerator = options.idGenerator ?? defaultIds;
  }

  /** Create a brand-new project from a request, applying defaults + validation. */
  create(init: ProjectInit): Project {
    const violations = validateProjectFields(init);
    if (violations.length > 0) {
      throw new ProjectValidationError(violations);
    }

    const now = this.clock.now() as Timestamp;
    const id = this.idGenerator.generate() as UUID as ProjectId;
    const slug = slugify(init.name);

    const project: Project = {
      id,
      name: init.name.trim(),
      description: init.description?.trim() ?? '',
      rootPath: normalizePath(init.rootPath),
      engine: init.engine ?? 'none',
      language: init.language ?? 'typescript',
      targetPlatforms: init.targetPlatforms ?? ['web'],
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      tags: init.tags ?? [],
      metadata: init.metadata ?? {},
      workspace: init.workspace ?? {},
      git: init.git ?? { enabled: false },
      plugins: init.plugins ?? { enabled: [] },
      model: init.model ?? {},
      memoryNamespace: `${slug}${NAMESPACE_SEPARATOR}memory` as MemoryNamespace,
      knowledgeNamespace: `${slug}${NAMESPACE_SEPARATOR}knowledge` as KnowledgeNamespace,
      missionNamespace: `${slug}${NAMESPACE_SEPARATOR}mission` as MissionNamespace,
    };

    assertValidProject(project);
    return project;
  }

  /**
   * Apply a patch to an existing, validated project, returning a *new* aggregate
   * (immutability — the original is never mutated). Re-stamps `updatedAt` and
   * re-validates. `createdAt`, `id`, and the namespaces are preserved.
   */
  update(existing: Project, patch: ProjectPatch): Project {
    const merged: Project = {
      ...existing,
      name: patch.name?.trim() ?? existing.name,
      description: patch.description?.trim() ?? existing.description,
      rootPath: patch.rootPath !== undefined ? normalizePath(patch.rootPath) : existing.rootPath,
      engine: patch.engine ?? existing.engine,
      language: patch.language ?? existing.language,
      targetPlatforms: patch.targetPlatforms ?? existing.targetPlatforms,
      tags: patch.tags ?? existing.tags,
      metadata: patch.metadata ?? existing.metadata,
      workspace: { ...existing.workspace, ...patch.workspace },
      git: { ...existing.git, ...patch.git },
      plugins: { ...existing.plugins, ...patch.plugins },
      model: { ...existing.model, ...patch.model },
      updatedAt: this.clock.now() as Timestamp,
    };

    const violations = validateProject(merged);
    if (violations.length > 0) {
      throw new ProjectValidationError(violations);
    }
    return merged;
  }

  /**
   * Produce a copy of an existing project with a new lifecycle status. Used by
   * the manager to transition `draft → open → closed` without re-validating the
   * entire aggregate (status is constrained by the caller).
   */
  withStatus(existing: Project, status: ProjectStatus): Project {
    return { ...existing, status, updatedAt: this.clock.now() as Timestamp };
  }
}

/** Turn a project name into a filesystem/namespace-safe slug. */
export function slugify(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.length > 0 ? cleaned : 'project';
}

/** Collapse redundant separators and trailing slashes without touching absoluteness. */
function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  return trimmed.replace(/\\/g, '/').replace(/\/+$/g, '') || '/';
}
