import {
  DuplicateWorkspaceError,
  WorkspaceConflictError,
  WorkspaceNotFoundError,
} from './WorkspaceErrors';
import type { Workspace, WorkspaceId } from './WorkspaceTypes';

/**
 * Storage + lookup for {@link Workspace} aggregates.
 *
 * The registry is the **only** component that persists workspaces in memory. It
 * is intentionally dumb about lifecycle and events — it answers "store / fetch /
 * list / remove" and enforces the uniqueness invariant (name). Higher-level
 * orchestration (events, state transitions, validation, project ownership) lives
 * in {@link WorkspaceManager}, keeping the registry trivially testable and
 * swappable.
 *
 * The registry owns no async I/O; future persistence adapters wrap it or replace
 * it behind the same surface, so the Workspace System can later back workspaces
 * with a database or file store without changing callers.
 */
export class WorkspaceRegistry {
  private readonly byId = new Map<WorkspaceId, Workspace>();
  private readonly byName = new Map<string, WorkspaceId>();

  /** Number of workspaces currently tracked. */
  get size(): number {
    return this.byId.size;
  }

  /**
   * Store a workspace. Throws {@link DuplicateWorkspaceError} on a duplicate id
   * and {@link WorkspaceConflictError} if another workspace already owns the
   * name. Replaces an existing workspace with the same id (id is the stable
   * identity).
   */
  add(workspace: Workspace): void {
    const existingWithName = this.byName.get(normalizeName(workspace.name));
    if (existingWithName !== undefined && existingWithName !== workspace.id) {
      throw new WorkspaceConflictError('name', workspace.name);
    }
    if (this.byId.has(workspace.id)) {
      throw new DuplicateWorkspaceError(workspace.id);
    }
    this.byId.set(workspace.id, workspace);
    this.byName.set(normalizeName(workspace.name), workspace.id);
  }

  /**
   * Replace a stored workspace, preserving id. Enforces the name uniqueness rule
   * against *other* workspaces (a workspace may keep its own name).
   */
  update(workspace: Workspace): void {
    const previous = this.byId.get(workspace.id);
    if (previous === undefined) {
      throw new WorkspaceNotFoundError(workspace.id);
    }
    const ownerOfName = this.byName.get(normalizeName(workspace.name));
    if (ownerOfName !== undefined && ownerOfName !== workspace.id) {
      throw new WorkspaceConflictError('name', workspace.name);
    }
    if (normalizeName(previous.name) !== normalizeName(workspace.name)) {
      this.byName.delete(normalizeName(previous.name));
    }
    this.byId.set(workspace.id, workspace);
    this.byName.set(normalizeName(workspace.name), workspace.id);
  }

  /** Fetch by id. Throws {@link WorkspaceNotFoundError} when absent. */
  get(id: WorkspaceId): Workspace {
    const workspace = this.byId.get(id);
    if (workspace === undefined) {
      throw new WorkspaceNotFoundError(id);
    }
    return workspace;
  }

  /** Fetch by id, or `undefined` when absent (non-throwing). */
  find(id: WorkspaceId): Workspace | undefined {
    return this.byId.get(id);
  }

  /** Fetch by name (case-insensitive), or `undefined` when no workspace owns it. */
  findByName(name: string): Workspace | undefined {
    const id = this.byName.get(normalizeName(name));
    return id === undefined ? undefined : this.byId.get(id);
  }

  /** True when a workspace with the given id is tracked. */
  has(id: WorkspaceId): boolean {
    return this.byId.has(id);
  }

  /** All tracked workspaces, in insertion order. */
  list(): ReadonlyArray<Workspace> {
    return [...this.byId.values()];
  }

  /** Remove a workspace by id. Throws {@link WorkspaceNotFoundError} when absent. */
  remove(id: WorkspaceId): void {
    const workspace = this.byId.get(id);
    if (workspace === undefined) {
      throw new WorkspaceNotFoundError(id);
    }
    this.byId.delete(id);
    if (this.byName.get(normalizeName(workspace.name)) === id) {
      this.byName.delete(normalizeName(workspace.name));
    }
  }

  /** Remove every tracked workspace. */
  clear(): void {
    this.byId.clear();
    this.byName.clear();
  }
}

/** Normalize a workspace name for collision detection (trim + lowercase). */
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}
