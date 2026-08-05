import type { ProjectId } from '@gamedev-agent/project';
import { analyzeProject } from '../analyze';
import { ProjectIndexCache } from '../cache/ProjectIndexCache';
import type { FileDelta, FileIndex, ProjectContext } from '../types';

export interface SummarizeResult {
  readonly context: ProjectContext;
  readonly delta: FileDelta;
  /** True when the cached projection was reused without re-analysis. */
  readonly incremental: boolean;
}

export interface ProjectSummarizerOptions {
  readonly cache?: ProjectIndexCache<ProjectContext>;
}

/**
 * Project Summarizer.
 *
 * The "Project Summary" capability: turns a {@link FileIndex} into a
 * structured {@link ProjectContext} and drives the incremental cache. On
 * unchanged scans it returns the cached projection untouched (no re-analysis);
 * on changed scans it recomposes and stores the new snapshot.
 */
export class ProjectSummarizer {
  private readonly cache: ProjectIndexCache<ProjectContext>;

  constructor(options?: ProjectSummarizerOptions) {
    this.cache = options?.cache ?? new ProjectIndexCache<ProjectContext>();
  }

  get(projectId: ProjectId): ProjectContext | null {
    return this.cache.get(projectId)?.context ?? null;
  }

  has(projectId: ProjectId): boolean {
    return this.cache.has(projectId);
  }

  invalidate(projectId: ProjectId): void {
    this.cache.remove(projectId);
  }

  /**
   * Summarize a scan for `projectId`. Reuses the cached projection when the
   * scan is unchanged; otherwise recomposes it and stores a new snapshot.
   */
  summarize(projectId: ProjectId, rootPath: string, files: FileIndex): SummarizeResult {
    const delta = this.cache.syncFiles(projectId, files);
    const cached = this.cache.get(projectId);

    if (delta.changedCount === 0 && cached !== null && cached.rootPath === rootPath) {
      return { context: cached.context, delta, incremental: true };
    }

    const context = analyzeProject(files, rootPath);
    this.cache.capture(projectId, rootPath, files, context);
    return { context, delta, incremental: false };
  }

  dispose(): void {
    this.cache.dispose();
  }
}
