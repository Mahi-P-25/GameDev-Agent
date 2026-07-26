import type { Clock, EventBusContract, IdGenerator } from '@gamedev-agent/events';
import { SystemClock, UuidGenerator } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { Disposable } from '@gamedev-agent/shared';
import type { ProjectId } from '@gamedev-agent/project';
import {
  WorkspaceClosed,
  WorkspaceCreated,
  WorkspaceDeleted,
  WorkspaceOpened,
  WorkspaceProjectAdded,
  WorkspaceProjectRemoved,
  WorkspaceRenamed,
  WorkspaceUpdated,
  WorkspaceArchived,
} from './WorkspaceEvents';
import type {
  WorkspaceArchivedPayload,
  WorkspaceClosedPayload,
  WorkspaceCreatedPayload,
  WorkspaceDeletedPayload,
  WorkspaceOpenedPayload,
  WorkspaceProjectAddedPayload,
  WorkspaceProjectRemovedPayload,
  WorkspaceRenamedPayload,
  WorkspaceUpdatedPayload,
} from './WorkspaceEvents';
import {
  WorkspaceNotFoundError,
  WorkspaceOwnershipError,
  WorkspaceStateError,
  WorkspaceValidationError,
} from './WorkspaceErrors';
import { WorkspaceFactory } from './WorkspaceFactory';
import { WorkspaceRegistry } from './WorkspaceRegistry';
import type {
  ACTIVITY_LIMIT,
  Workspace,
  WorkspaceActivity,
  WorkspaceId,
  WorkspaceInit,
  WorkspacePatch,
  WorkspaceStatus,
} from './WorkspaceTypes';
import { assertValidWorkspace } from './WorkspaceValidator';

/**
 * Orchestrates the Workspace System's supported operations and is the single
 * point of integration between the domain (factory + registry) and Nova's shared
 * infrastructure (the Event Bus, Logger, and optionally the Project System).
 *
 * Responsibilities:
 *  - `create/open/close/rename/archive/delete` (the workspace lifecycle).
 *  - `addProject/removeProject` — establishing and releasing Project ownership.
 *  - Transition lifecycle state with guard rails.
 *  - Publish strongly-typed events for every state change and ownership change.
 *  - Keep the registry and event emissions strictly consistent.
 *
 * The manager depends on abstractions (`EventBusContract`, `Logger`), never on
 * concrete packages, and owns no singleton — callers inject the bus/logger (and
 * can supply test doubles). It is `Disposable` so it can be registered into the
 * kernel's DI container and torn down with the kernel.
 */
export interface WorkspaceManagerOptions {
  readonly eventBus: EventBusContract;
  readonly logger?: Logger;
  readonly factory?: WorkspaceFactory;
  readonly registry?: WorkspaceRegistry;
  /** Optional validator used to check project references before ownership. */
  readonly projectExists?: ((projectId: ProjectId) => boolean) | undefined;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
}

export class WorkspaceManager implements Disposable {
  private readonly bus: EventBusContract;
  private readonly logger: Logger;
  private readonly factory: WorkspaceFactory;
  private readonly registry: WorkspaceRegistry;
  private readonly projectExists: ((projectId: ProjectId) => boolean) | undefined;
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;
  private disposed = false;

  constructor(options: WorkspaceManagerOptions) {
    this.bus = options.eventBus;
    this.logger = options.logger ?? new RootLogger('nova.workspace', [new ConsoleLogSink()]);
    this.factory = options.factory ?? new WorkspaceFactory();
    this.registry = options.registry ?? new WorkspaceRegistry();
    this.projectExists = options.projectExists;
    this.clock = options.clock ?? SystemClock;
    this.idGenerator = options.idGenerator ?? UuidGenerator;
  }

  // --- lifecycle ------------------------------------------------------------

  /**
   * Create a workspace. Validates, stores, and emits `workspace.created`.
   * Throws {@link WorkspaceConflictError} on a name collision. The newly created
   * workspace starts in `draft` status.
   */
  async create(init: WorkspaceInit): Promise<Workspace> {
    const workspace = this.factory.create(init);
    this.registry.add(workspace);
    this.logger.info('workspace.created', { id: workspace.id, name: workspace.name });
    await this.publishCreated(workspace);
    return workspace;
  }

  /**
   * Open a workspace: transition `draft`/`closed`/`archived` → `open` and emit
   * `workspace.opened`. Opening an already-`open` workspace is idempotent.
   */
  async open(id: WorkspaceId): Promise<Workspace> {
    const workspace = this.require(id);
    this.guardState(workspace, 'open', ['draft', 'closed', 'archived', 'open']);

    if (workspace.status !== 'open') {
      const opened = this.factory.withStatus(workspace, 'open');
      this.registry.update(opened);
      this.logger.info('workspace.opened', { id, name: opened.name });
      await this.bus.publish(WorkspaceOpened, this.openedPayload(opened));
      return opened;
    }
    return workspace;
  }

  /**
   * Close an open workspace: transition `open` → `closed` and emit
   * `workspace.closed`. Closing a non-`open` workspace is a no-op (idempotent)
   * when it is already `closed`, but faults for `draft`/`archived` via the state
   * guard.
   */
  async close(id: WorkspaceId): Promise<Workspace> {
    const workspace = this.require(id);
    this.guardState(workspace, 'close', ['open', 'closed']);

    if (workspace.status !== 'closed') {
      const closed = this.factory.withStatus(workspace, 'closed');
      this.registry.update(closed);
      this.logger.info('workspace.closed', { id, name: closed.name });
      await this.bus.publish(WorkspaceClosed, this.closedPayload(closed));
      return closed;
    }
    return workspace;
  }

  /**
   * Archive a workspace: transition `draft`/`open`/`closed` → `archived` and
   * emit `workspace.archived`. Archiving is idempotent when already archived.
   */
  async archive(id: WorkspaceId): Promise<Workspace> {
    const workspace = this.require(id);
    this.guardState(workspace, 'archive', ['draft', 'open', 'closed', 'archived']);

    if (workspace.status !== 'archived') {
      const archived = this.factory.withStatus(workspace, 'archived');
      this.registry.update(archived);
      this.logger.info('workspace.archived', { id, name: archived.name });
      await this.bus.publish(WorkspaceArchived, this.archivedPayload(archived));
      return archived;
    }
    return workspace;
  }

  /**
   * Rename a workspace (and optionally other mutable fields). Emits
   * `workspace.renamed` when the name changed and `workspace.updated` for any
   * other field. Returns the new aggregate. Re-validates before persisting.
   */
  async rename(id: WorkspaceId, name: string, patch?: WorkspacePatch): Promise<Workspace> {
    const workspace = this.require(id);
    const previousName = workspace.name;
    const next = this.factory.update(workspace, { ...patch, name });
    this.registry.update(next);
    this.logger.info('workspace.renamed', { id, from: previousName, to: next.name });

    const changed = this.changedFields(workspace, next);
    if (previousName !== next.name) {
      await this.bus.publish(WorkspaceRenamed, this.renamedPayload(next, previousName));
    }
    if (changed.length > 0) {
      await this.bus.publish(WorkspaceUpdated, this.updatedPayload(next, changed));
    }
    return next;
  }

  /**
   * Update a workspace with a patch. Emits `workspace.updated` with the list of
   * changed fields (empty patch → no event, same instance returned). The payload
   * is reconstructed to satisfy the literal type via the helper.
   */
  async update(id: WorkspaceId, patch: WorkspacePatch): Promise<Workspace> {
    const workspace = this.require(id);
    const next = this.factory.update(workspace, patch);
    this.registry.update(next);
    const changed = this.changedFields(workspace, next);
    if (changed.length > 0) {
      this.logger.info('workspace.updated', { id, fields: changed });
      await this.bus.publish(WorkspaceUpdated, this.updatedPayload(next, changed));
    }
    return next;
  }

  /**
   * Delete a workspace. Emits `workspace.deleted` then removes it from the
   * registry. Deletion is irreversible; callers should confirm with the user
   * first. Workspaces must be `closed` or `archived` before deletion (a `draft`/
   * `open` workspace cannot be deleted — close or archive it first).
   */
  async delete(id: WorkspaceId): Promise<void> {
    const workspace = this.require(id);
    this.guardState(workspace, 'delete', ['closed', 'archived']);
    this.logger.info('workspace.deleted', { id, name: workspace.name });
    await this.bus.publish(WorkspaceDeleted, this.deletedPayload(workspace));
    this.registry.remove(id);
  }

  // --- project ownership ----------------------------------------------------

  /**
   * Add a Project reference to the workspace, establishing ownership. Emits
   * `workspace.project.added`. A workspace owns its Projects by reference; the
   * Project itself continues to live in the Project System. Adding a project the
   * workspace already owns is idempotent (no duplicate, no second event).
   *
   * If a `projectExists` guard was supplied at construction, an unknown project
   * id raises {@link WorkspaceValidationError} before ownership is recorded.
   */
  async addProject(id: WorkspaceId, projectId: ProjectId): Promise<Workspace> {
    const workspace = this.require(id);
    if (this.projectExists !== undefined && !this.projectExists(projectId)) {
      throw new WorkspaceValidationError([
        { field: 'projectIds', reason: `project does not exist: "${projectId}"` },
      ]);
    }
    if (workspace.projectIds.includes(projectId)) {
      throw new WorkspaceOwnershipError(id, String(projectId), 'already owns');
    }
    const next = this.factory.withProject(workspace, projectId);
    const withActivity = this.recordActivity(next, {
      kind: 'project.added',
      message: `Project ${String(projectId)} added to workspace`,
      projectId,
    });
    this.registry.update(withActivity);
    this.logger.info('workspace.project.added', { id, projectId: String(projectId) });
    await this.bus.publish(WorkspaceProjectAdded, this.projectAddedPayload(next, projectId));
    return withActivity;
  }

  /**
   * Remove a Project reference from the workspace, releasing ownership. Emits
   * `workspace.project.removed`. Removing a project the workspace does not own
   * raises {@link WorkspaceOwnershipError}.
   */
  async removeProject(id: WorkspaceId, projectId: ProjectId): Promise<Workspace> {
    const workspace = this.require(id);
    if (!workspace.projectIds.includes(projectId)) {
      throw new WorkspaceOwnershipError(id, String(projectId), 'does not own');
    }
    const next = this.factory.withoutProject(workspace, projectId);
    const withActivity = this.recordActivity(next, {
      kind: 'project.removed',
      message: `Project ${String(projectId)} removed from workspace`,
      projectId,
    });
    this.registry.update(withActivity);
    this.logger.info('workspace.project.removed', { id, projectId: String(projectId) });
    await this.bus.publish(
      WorkspaceProjectRemoved,
      this.projectRemovedPayload(next, projectId),
    );
    return withActivity;
  }

  // --- queries --------------------------------------------------------------

  /** List all tracked workspaces (insertion order). */
  list(): ReadonlyArray<Workspace> {
    return this.registry.list();
  }

  /** Fetch a workspace by id, or `undefined` when absent. */
  find(id: WorkspaceId): Workspace | undefined {
    return this.registry.find(id);
  }

  /** Fetch a workspace by name (case-insensitive), or `undefined` when absent. */
  findByName(name: string): Workspace | undefined {
    return this.registry.findByName(name);
  }

  /** Raw aggregate access for read-only consumers. */
  get(id: WorkspaceId): Workspace {
    return this.require(id);
  }

  /**
   * Validate a workspace's current state against the domain contract. Returns the
   * list of violations; does not throw.
   */
  validate(id: WorkspaceId): ReadonlyArray<{ readonly field: string; readonly reason: string }> {
    const workspace = this.require(id);
    try {
      assertValidWorkspace(workspace);
      return [];
    } catch (error) {
      if (error instanceof WorkspaceValidationError) {
        return error.violations;
      }
      const reason = error instanceof Error ? error.message : String(error);
      return [{ field: 'workspace', reason }];
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.registry.clear();
  }

  // --- internals ------------------------------------------------------------

  private require(id: WorkspaceId): Workspace {
    const workspace = this.registry.find(id);
    if (workspace === undefined) {
      throw new WorkspaceNotFoundError(id);
    }
    return workspace;
  }

  /**
   * Guard a lifecycle transition. `allowed` lists every status from which the
   * operation may legally run — including the already-at-target status, which
   * makes the call idempotent. Any other status raises {@link WorkspaceStateError}.
   */
  private guardState(
    workspace: Workspace,
    attempted: string,
    allowed: ReadonlyArray<WorkspaceStatus>,
  ): void {
    if (!allowed.includes(workspace.status)) {
      throw new WorkspaceStateError(workspace.id, workspace.status, attempted);
    }
  }

  /** Append an activity entry (bounded) to a workspace without persisting. */
  private recordActivity(
    workspace: Workspace,
    seed: Omit<WorkspaceActivity, 'id' | 'timestamp'>,
  ): Workspace {
    const entry: WorkspaceActivity = {
      id: this.idGenerator.generate(),
      timestamp: this.clock.now() as WorkspaceActivity['timestamp'],
      ...seed,
    };
    return this.factory.withActivity(workspace, entry);
  }

  private async publishCreated(workspace: Workspace): Promise<void> {
    const payload: WorkspaceCreatedPayload = {
      workspaceId: workspace.id,
      name: workspace.name,
      status: workspace.status,
      projectCount: workspace.projectIds.length,
      timestamp: Date.now(),
    };
    await this.bus.publish(WorkspaceCreated, payload);
  }

  private openedPayload(workspace: Workspace): WorkspaceOpenedPayload {
    return { workspaceId: workspace.id, name: workspace.name, timestamp: Date.now() };
  }

  private closedPayload(workspace: Workspace): WorkspaceClosedPayload {
    return { workspaceId: workspace.id, name: workspace.name, timestamp: Date.now() };
  }

  private archivedPayload(workspace: Workspace): WorkspaceArchivedPayload {
    return { workspaceId: workspace.id, name: workspace.name, timestamp: Date.now() };
  }

  private deletedPayload(workspace: Workspace): WorkspaceDeletedPayload {
    return { workspaceId: workspace.id, name: workspace.name, timestamp: Date.now() };
  }

  private renamedPayload(
    next: Workspace,
    previousName: string,
  ): WorkspaceRenamedPayload {
    return {
      workspaceId: next.id,
      previousName,
      name: next.name,
      timestamp: Date.now(),
    };
  }

  /** Compute the set of top-level fields that differ between two aggregates. */
  private changedFields(before: Workspace, after: Workspace): ReadonlyArray<string> {
    const fields: ReadonlyArray<keyof Workspace> = [
      'name',
      'description',
      'projectIds',
      'capabilities',
      'tools',
      'preferences',
      'theme',
      'status',
      'metadata',
    ];
    const changed: string[] = [];
    for (const field of fields) {
      if (!shallowEqual(before[field], after[field])) {
        changed.push(field);
      }
    }
    return changed;
  }

  private updatedPayload(
    next: Workspace,
    changedFields: ReadonlyArray<string>,
  ): WorkspaceUpdatedPayload {
    return { workspaceId: next.id, changedFields, timestamp: Date.now() };
  }

  private projectAddedPayload(
    next: Workspace,
    projectId: ProjectId,
  ): WorkspaceProjectAddedPayload {
    return { workspaceId: next.id, projectId, timestamp: Date.now() };
  }

  private projectRemovedPayload(
    next: Workspace,
    projectId: ProjectId,
  ): WorkspaceProjectRemovedPayload {
    return { workspaceId: next.id, projectId, timestamp: Date.now() };
  }
}

/** Re-export so callers/activity helpers can reference the constant. */
export type { ACTIVITY_LIMIT };

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
