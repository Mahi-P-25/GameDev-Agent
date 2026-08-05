import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { Project, ProjectId, ProjectManager } from '@gamedev-agent/project';
import { ProjectOpened } from '@gamedev-agent/project';
import type { Disposable } from '@gamedev-agent/shared';
import type { WorkspaceManager } from '@gamedev-agent/workspace';
import {
  type IndexStage,
  ProjectIndexCompleted,
  ProjectIndexFailed,
  ProjectIndexProgress,
  ProjectIndexStarted,
} from './ProjectIntelligenceEvents';
import { ProjectIntelligenceError, ProjectIntelligenceIndexed } from './ProjectIntelligenceEvents';
import { ProjectSummarizer } from './summarizer/ProjectSummarizer';
import type { FileIndex, ProjectContext } from './types';

/** The seam the manager needs from an indexer — walk a root into a FileIndex. */
export interface ProjectIndexerLike {
  index(rootPath: string): Promise<FileIndex>;
}

/** Options for constructing the {@link ProjectIntelligenceManager}. */
export interface ProjectIntelligenceManagerOptions {
  readonly eventBus: EventBusContract;
  readonly logger?: Logger;
  /** The Project subsystem — resolves a project's real rootPath on open. */
  readonly projects: ProjectManager;
  /** The Workspace subsystem — loads/opens the workspace a project belongs to. */
  readonly workspaces: WorkspaceManager;
  /** Indexes a project's files through the Filesystem tool seam. */
  readonly indexer: ProjectIndexerLike;
  /** Name used when a workspace must be created to host a project. */
  readonly workspaceName?: string;
  /** Project summary + incremental cache. Injected for tests; defaulted in prod. */
  readonly summarizer?: ProjectSummarizer;
}

/**
 * Project Intelligence — the kernel-side service that makes opening a project
 * meaningful:
 *
 *   1. When a {@link ProjectOpened} event fires, it loads the project's
 *      workspace (creating and opening one when the project has none yet).
 *   2. It indexes the project's root through the {@link ProjectIndexer}
 *      (Filesystem tool seam): file tree, framework/language, package manager,
 *      and dependency discovery.
 *   3. It summarizes the scan through the {@link ProjectSummarizer}, which
 *      reuses the cached projection when nothing changed.
 *   4. It publishes the `project.index.*` lifecycle events
 *      (started → progress → completed | failed) and, for compatibility, the
 *      legacy {@link ProjectIntelligenceIndexed} / {@link ProjectIntelligenceError}.
 *
 * The manager owns no project state — it reads through the Project and
 * Workspace managers and caches only the derived index, keyed by project id.
 */
export class ProjectIntelligenceManager implements Disposable {
  private readonly bus: EventBusContract;
  private readonly logger: Logger;
  private readonly projects: ProjectManager;
  private readonly workspaces: WorkspaceManager;
  private readonly indexer: ProjectIndexerLike;
  private readonly workspaceName: string;
  private readonly summarizer: ProjectSummarizer;

  private readonly disposers: Array<Disposable> = [];
  private started = false;
  private disposed = false;

  constructor(options: ProjectIntelligenceManagerOptions) {
    this.bus = options.eventBus;
    this.logger =
      options.logger ?? new RootLogger('nova.project-intelligence', [new ConsoleLogSink()]);
    this.projects = options.projects;
    this.workspaces = options.workspaces;
    this.indexer = options.indexer;
    this.workspaceName = options.workspaceName ?? 'Nova Workspace';
    this.summarizer = options.summarizer ?? new ProjectSummarizer();
  }

  /**
   * Subscribe to the Project subsystem's `project.opened` stream. Must be called
   * once the kernel is `running` so the bus is fully wired. Idempotent.
   */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.disposers.push(
      this.bus.subscribe(ProjectOpened, (envelope) => {
        void this.handleProjectOpened(envelope.payload.projectId);
      }),
    );
    this.logger.info('project-intelligence.started', {});
  }

  /**
   * Index a project's root now and cache the result. Publishes the
   * `project.index.started → progress → completed` lifecycle; rethrows on
   * failure after publishing `project.index.failed`.
   */
  async indexProject(projectId: ProjectId, rootPath: string): Promise<ProjectContext> {
    const startedAt = Date.now();
    const incremental = this.summarizer.has(projectId);

    await this.bus.publish(ProjectIndexStarted, {
      projectId,
      rootPath,
      incremental,
      timestamp: Date.now(),
    });

    try {
      const files: FileIndex = await this.indexer.index(rootPath);
      const total = Object.keys(files).length;
      await this.emitProgress(projectId, rootPath, 'scan', total, total);

      const result = this.summarizer.summarize(projectId, rootPath, files);
      await this.emitProgress(projectId, rootPath, 'summary', total, total);

      await this.bus.publish(ProjectIndexCompleted, {
        projectId,
        rootPath,
        totalFiles: result.context.summary.totalFiles,
        totalDirs: result.context.summary.totalDirs,
        durationMs: Date.now() - startedAt,
        incremental: result.incremental,
        changedFiles: result.delta.changedCount,
        timestamp: Date.now(),
      });
      return result.context;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn('project-intelligence.index-failed', { projectId, error: message });
      await this.bus.publish(ProjectIndexFailed, {
        projectId,
        rootPath,
        stage: 'scan',
        error: message,
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  /** The cached index for a project, or `null` when it has not been indexed. */
  get(projectId: ProjectId): ProjectContext | null {
    return this.summarizer.get(projectId);
  }

  /** Whether a project's index is currently cached. */
  has(projectId: ProjectId): boolean {
    return this.summarizer.has(projectId);
  }

  /** Drop the cached index for a project (e.g. after the project is closed). */
  invalidate(projectId: ProjectId): void {
    this.summarizer.invalidate(projectId);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const disposer of this.disposers.splice(0)) {
      disposer.dispose();
    }
    this.summarizer.dispose();
  }

  // --- internals -------------------------------------------------------------

  private async emitProgress(
    projectId: ProjectId,
    rootPath: string,
    stage: IndexStage,
    processed: number,
    total: number,
  ): Promise<void> {
    const percent = total === 0 ? 100 : Math.min(100, Math.round((processed / total) * 100));
    await this.bus.publish(ProjectIndexProgress, {
      projectId,
      rootPath,
      stage,
      processed,
      total,
      percent,
      timestamp: Date.now(),
    });
  }

  private async handleProjectOpened(projectId: ProjectId): Promise<void> {
    try {
      const project = this.projects.find(projectId);
      if (project === undefined) {
        this.logger.warn('project-intelligence.project-not-found', { projectId });
        return;
      }
      await this.loadWorkspace(project);
      const context = await this.indexProject(project.id, project.rootPath);
      await this.bus.publish(ProjectIntelligenceIndexed, {
        projectId: project.id,
        rootPath: project.rootPath,
        totalFiles: context.summary.totalFiles,
        packageManagers: context.summary.packageManagers,
        timestamp: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn('project-intelligence.index-failed', { projectId, error: message });
      await this.bus.publish(ProjectIntelligenceError, {
        projectId,
        rootPath: '',
        error: message,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Ensure the project has a loaded workspace: reuse the workspace that already
   * owns it, or create one, adopt the project, and open it. Publishes the
   * workspace events the Context Engine observes, so the workspace becomes part
   * of the live context.
   */
  private async loadWorkspace(project: Project): Promise<void> {
    const existing = this.workspaces
      .list()
      .find((workspace) => workspace.projectIds.includes(project.id));
    if (existing !== undefined) {
      await this.workspaces.open(existing.id);
      return;
    }
    const created = await this.workspaces.create({ name: this.workspaceName });
    await this.workspaces.addProject(created.id, project.id);
    await this.workspaces.open(created.id);
  }
}
