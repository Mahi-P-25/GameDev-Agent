import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { Disposable } from '@gamedev-agent/shared';
import {
  DuplicateProjectError,
  ProjectConflictError,
  ProjectNotFoundError,
  ProjectStateError,
} from './ProjectErrors';
import {
  ProjectClosed,
  ProjectCreated,
  type ProjectCreatedPayload,
  ProjectDeleted,
  ProjectOpened,
  ProjectRenamed,
  ProjectUpdated,
} from './ProjectEvents';
import { ProjectFactory } from './ProjectFactory';
import { ProjectRegistry } from './ProjectRegistry';
import type {
  Engine,
  KnowledgeNamespace,
  MemoryNamespace,
  MissionNamespace,
  Project,
  ProjectId,
  ProjectInit,
  ProjectPatch,
  ProjectStatus,
} from './ProjectTypes';
import { assertValidProject } from './ProjectValidator';

/**
 * Orchestrates the Project System's supported operations and is the single point
 * of integration between the domain (factory + registry) and Nova's shared
 * infrastructure (the Event Bus and Logger).
 *
 * Responsibilities:
 *  - `create/open/close/rename/delete/list/validate` (the Sprint-4 surface).
 *  - Transition project lifecycle state with guard rails.
 *  - Publish strongly-typed events for every state change.
 *  - Keep the registry and event emissions strictly consistent.
 *
 * The manager depends on abstractions (`EventBusContract`, `Logger`), never on
 * concrete packages, and owns no singleton — callers inject the bus/logger (and
 * can supply test doubles). It is `Disposable` so it can be registered into the
 * kernel's DI container and torn down with the kernel.
 */
export interface ProjectManagerOptions {
  readonly eventBus: EventBusContract;
  readonly logger?: Logger;
  readonly factory?: ProjectFactory;
  readonly registry?: ProjectRegistry;
}

export class ProjectManager implements Disposable {
  private readonly bus: EventBusContract;
  private readonly logger: Logger;
  private readonly factory: ProjectFactory;
  private readonly registry: ProjectRegistry;
  private disposed = false;

  constructor(options: ProjectManagerOptions) {
    this.bus = options.eventBus;
    this.logger = options.logger ?? new RootLogger('nova.project', [new ConsoleLogSink()]);
    this.factory = options.factory ?? new ProjectFactory();
    this.registry = options.registry ?? new ProjectRegistry();
  }

  /**
   * Create a project. Validates, stores, and emits `project.created`.
   * Throws {@link DuplicateProjectError}/{@link ProjectConflictError} on
   * collision. The newly created project starts in `draft` status.
   */
  async create(init: ProjectInit): Promise<Project> {
    const project = this.factory.create(init);
    this.registry.add(project);
    this.logger.info('project.created', { id: project.id, name: project.name });
    await this.publishCreated(project);
    return project;
  }

  /**
   * Open a project: transition `draft`/`closed`/`archived` → `open` and emit
   * `project.opened`. Opening an already-`open` project is idempotent (re-emits).
   */
  async open(id: ProjectId): Promise<Project> {
    const project = this.require(id);
    this.guardState(project, 'open', ['draft', 'closed', 'archived', 'open']);

    if (project.status !== 'open') {
      const opened = this.factory.withStatus(project, 'open');
      this.registry.update(opened);
      this.logger.info('project.opened', { id, name: opened.name });
      await this.bus.publish(ProjectOpened, {
        projectId: id,
        name: opened.name,
        timestamp: Date.now(),
      });
      return opened;
    }
    return project;
  }

  /**
   * Close an open project: transition `open` → `closed` and emit
   * `project.closed`. Closing a non-`open` project is a no-op (idempotent) when
   * it is already `closed`, but faults for `draft`/`archived` via the state
   * guard.
   */
  async close(id: ProjectId): Promise<Project> {
    const project = this.require(id);
    this.guardState(project, 'close', ['open', 'closed']);

    if (project.status !== 'closed') {
      const closed = this.factory.withStatus(project, 'closed');
      this.registry.update(closed);
      this.logger.info('project.closed', { id, name: closed.name });
      await this.bus.publish(ProjectClosed, {
        projectId: id,
        name: closed.name,
        timestamp: Date.now(),
      });
      return closed;
    }
    return project;
  }

  /**
   * Rename a project (and optionally other mutable fields). Emits
   * `project.renamed` when the name changed and `project.updated` for any other
   * field. Returns the new aggregate. Re-validates before persisting.
   */
  async rename(id: ProjectId, name: string, patch?: ProjectPatch): Promise<Project> {
    const project = this.require(id);
    const previousName = project.name;
    const next = this.factory.update(project, { ...patch, name });
    this.registry.update(next);
    this.logger.info('project.renamed', { id, from: previousName, to: next.name });

    const changed = collectChangedFields(project, next);
    if (previousName !== next.name) {
      await this.bus.publish(ProjectRenamed, {
        projectId: id,
        previousName,
        name: next.name,
        timestamp: Date.now(),
      });
    }
    if (changed.length > 0) {
      await this.bus.publish(ProjectUpdated, {
        projectId: id,
        changedFields: changed,
        timestamp: Date.now(),
      });
    }
    return next;
  }

  /**
   * Update a project with a patch. Emits `project.updated` with the list of
   * changed fields (empty patch → no event, same instance returned).
   */
  async update(id: ProjectId, patch: ProjectPatch): Promise<Project> {
    const project = this.require(id);
    const next = this.factory.update(project, patch);
    this.registry.update(next);
    const changed = collectChangedFields(project, next);
    if (changed.length > 0) {
      this.logger.info('project.updated', { id, fields: changed });
      await this.bus.publish(ProjectUpdated, {
        projectId: id,
        changedFields: changed,
        timestamp: Date.now(),
      });
    }
    return next;
  }

  /**
   * Delete a project. Emits `project.deleted` then removes it from the registry.
   * Deletion is irreversible; callers should confirm with the user first.
   */
  async delete(id: ProjectId): Promise<void> {
    const project = this.require(id);
    this.logger.info('project.deleted', { id, name: project.name });
    await this.bus.publish(ProjectDeleted, {
      projectId: id,
      name: project.name,
      rootPath: project.rootPath,
      timestamp: Date.now(),
    });
    this.registry.remove(id);
  }

  /** List all tracked projects (insertion order). */
  list(): ReadonlyArray<Project> {
    return this.registry.list();
  }

  /** Fetch a project by id, or `undefined` when absent. */
  find(id: ProjectId): Project | undefined {
    return this.registry.find(id);
  }

  /**
   * Validate a project's current state against the domain contract. Returns the
   * list of violations; does not throw. Useful for surfacing issues to a user
   * before committing changes through other subsystems.
   */
  validate(id: ProjectId): ReadonlyArray<{ readonly field: string; readonly reason: string }> {
    const project = this.require(id);
    return validateNow(project, this.logger);
  }

  /** Raw aggregate access for read-only consumers. */
  get(id: ProjectId): Project {
    return this.require(id);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.registry.clear();
  }

  // --- internals ----------------------------------------------------------

  private require(id: ProjectId): Project {
    const project = this.registry.find(id);
    if (project === undefined) {
      throw new ProjectNotFoundError(id);
    }
    return project;
  }

  /**
   * Guard a lifecycle transition. `allowed` lists every status from which the
   * operation may legally run — including the already-at-target status, which
   * makes the call idempotent (already-open projects may be "opened" again).
   * Any other status raises {@link ProjectStateError}.
   */
  private guardState(
    project: Project,
    attempted: string,
    allowed: ReadonlyArray<ProjectStatus>,
  ): void {
    if (!allowed.includes(project.status)) {
      throw new ProjectStateError(project.id, project.status, attempted);
    }
  }

  private async publishCreated(project: Project): Promise<void> {
    const payload: ProjectCreatedPayload = {
      projectId: project.id,
      name: project.name,
      rootPath: project.rootPath,
      engine: project.engine as Engine,
      status: project.status,
      memoryNamespace: project.memoryNamespace as MemoryNamespace,
      knowledgeNamespace: project.knowledgeNamespace as KnowledgeNamespace,
      missionNamespace: project.missionNamespace as MissionNamespace,
      timestamp: Date.now(),
    };
    await this.bus.publish(ProjectCreated, payload);
  }
}

/** Re-validate at runtime; returns violations without throwing. */
function validateNow(
  project: Project,
  logger: Logger,
): ReadonlyArray<{ readonly field: string; readonly reason: string }> {
  try {
    assertValidProject(project);
    return [];
  } catch (error) {
    if (error instanceof Error && 'violations' in error) {
      const narrowed = error as unknown as {
        violations: ReadonlyArray<{ field: string; reason: string }>;
      };
      return narrowed.violations;
    }
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn('project.validate.unexpected', { error: String(error) });
    return [{ field: 'project', reason }];
  }
}

/** Compute the set of top-level fields that differ between two aggregates. */
function collectChangedFields(before: Project, after: Project): ReadonlyArray<string> {
  const fields: ReadonlyArray<keyof Project> = [
    'name',
    'description',
    'rootPath',
    'engine',
    'language',
    'targetPlatforms',
    'status',
    'tags',
    'metadata',
    'workspace',
    'git',
    'plugins',
    'model',
  ];
  const changed: string[] = [];
  for (const field of fields) {
    if (!shallowEqual(before[field], after[field])) {
      changed.push(field);
    }
  }
  return changed;
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    const ak = Object.keys(a as object);
    const bk = Object.keys(b as object);
    if (ak.length !== bk.length) {
      return false;
    }
    return ak.every(
      (key) => (a as Record<string, unknown>)[key] === (b as Record<string, unknown>)[key],
    );
  }
  return false;
}
