import type { AbsolutePath, WorkflowId } from './ContextTypes';
import { RECENT_FILES_LIMIT, RECENT_WORKFLOWS_LIMIT } from './ContextTypes';

/**
 * Bounded recency ring for the Creative Director's recent files and workflows.
 *
 * The Context Engine surfaces "recent files" and "recent workflows" so the
 * Studio can offer instant "Continue Working" and quick re-runs without the
 * Director re-navigating. {@link ContextHistory} owns the ordering policy — most
 * recent first, de-duplicated, capped at the configured limits — and is the
 * single source of truth the {@link ContextManager} consults when it records a
 * touch. The live snapshot is then folded back into the {@link CurrentContext}
 * aggregate by the {@link ContextFactory}.
 */
export class ContextHistory {
  /** Record a file touch, returning the new recent-files order (newest first). */
  recordFile(recent: ReadonlyArray<AbsolutePath>, file: string): ReadonlyArray<AbsolutePath> {
    const path = file as AbsolutePath;
    return [path, ...recent.filter((entry) => entry !== path)].slice(
      0,
      RECENT_FILES_LIMIT as number,
    );
  }

  /** Record a workflow use, returning the new recent-workflows order (newest first). */
  recordWorkflow(
    recent: ReadonlyArray<WorkflowId>,
    workflowId: WorkflowId,
  ): ReadonlyArray<WorkflowId> {
    return [workflowId, ...recent.filter((entry) => entry !== workflowId)].slice(
      0,
      RECENT_WORKFLOWS_LIMIT as number,
    );
  }

  /** Whether a file is already present in the recent ring. */
  hasFile(recent: ReadonlyArray<AbsolutePath>, file: string): boolean {
    return recent.includes(file as AbsolutePath);
  }

  /** Whether a workflow is already present in the recent ring. */
  hasWorkflow(recent: ReadonlyArray<WorkflowId>, workflowId: WorkflowId): boolean {
    return recent.includes(workflowId);
  }

  /** Drop every entry (used when the context is reset). */
  clear(): { files: ReadonlyArray<AbsolutePath>; workflows: ReadonlyArray<WorkflowId> } {
    return { files: [], workflows: [] };
  }
}
