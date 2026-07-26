import { DuplicateProjectError, ProjectConflictError, ProjectNotFoundError } from './ProjectErrors';
import type { Project, ProjectId } from './ProjectTypes';

/**
 * Storage + lookup for {@link Project} aggregates.
 *
 * The registry is the **only** component that persists projects in memory. It is
 * intentionally dumb about lifecycle and events — it answers "store / fetch /
 * list / remove" and enforces the two uniqueness invariants (id and root path).
 * Higher-level orchestration (events, state transitions, validation) lives in
 * {@link ProjectManager}, keeping the registry trivially testable and swappable.
 *
 * The registry owns no async I/O; future persistence adapters wrap it or replace
 * it behind the same surface, so the Project System can later back projects with
 * a database or file store without changing callers.
 */
export class ProjectRegistry {
  private readonly byId = new Map<ProjectId, Project>();
  private readonly byPath = new Map<string, ProjectId>();

  /** Number of projects currently tracked. */
  get size(): number {
    return this.byId.size;
  }

  /**
   * Store a project. Throws {@link DuplicateProjectError} on a duplicate id and
   * {@link ProjectConflictError} if another project already owns the root path.
   * Replaces an existing project with the same id (id is the stable identity).
   */
  add(project: Project): void {
    const existingWithPath = this.byPath.get(project.rootPath);
    if (existingWithPath !== undefined && existingWithPath !== project.id) {
      throw new ProjectConflictError('rootPath', project.rootPath);
    }
    if (this.byId.has(project.id)) {
      throw new DuplicateProjectError(project.id);
    }
    this.byId.set(project.id, project);
    this.byPath.set(project.rootPath, project.id);
  }

  /** Replace a stored project, preserving id. Enforces the path uniqueness rule. */
  update(project: Project): void {
    const previous = this.byId.get(project.id);
    if (previous === undefined) {
      throw new ProjectNotFoundError(project.id);
    }
    const ownerOfPath = this.byPath.get(project.rootPath);
    if (ownerOfPath !== undefined && ownerOfPath !== project.id) {
      throw new ProjectConflictError('rootPath', project.rootPath);
    }
    if (previous.rootPath !== project.rootPath) {
      this.byPath.delete(previous.rootPath);
    }
    this.byId.set(project.id, project);
    this.byPath.set(project.rootPath, project.id);
  }

  /** Fetch by id. Throws {@link ProjectNotFoundError} when absent. */
  get(id: ProjectId): Project {
    const project = this.byId.get(id);
    if (project === undefined) {
      throw new ProjectNotFoundError(id);
    }
    return project;
  }

  /** Fetch by id, or `undefined` when absent (non-throwing). */
  find(id: ProjectId): Project | undefined {
    return this.byId.get(id);
  }

  /** Fetch by root path, or `undefined` when no project owns it. */
  findByPath(rootPath: string): Project | undefined {
    const id = this.byPath.get(rootPath);
    return id === undefined ? undefined : this.byId.get(id);
  }

  /** True when a project with the given id is tracked. */
  has(id: ProjectId): boolean {
    return this.byId.has(id);
  }

  /** True when any tracked project owns the given root path. */
  hasPath(rootPath: string): boolean {
    return this.byPath.has(rootPath);
  }

  /** All tracked projects, in insertion order. */
  list(): ReadonlyArray<Project> {
    return [...this.byId.values()];
  }

  /** Remove a project by id. Throws {@link ProjectNotFoundError} when absent. */
  remove(id: ProjectId): void {
    const project = this.byId.get(id);
    if (project === undefined) {
      throw new ProjectNotFoundError(id);
    }
    this.byId.delete(id);
    if (this.byPath.get(project.rootPath) === id) {
      this.byPath.delete(project.rootPath);
    }
  }

  /** Remove every tracked project. */
  clear(): void {
    this.byId.clear();
    this.byPath.clear();
  }
}
