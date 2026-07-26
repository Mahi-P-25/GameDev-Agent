import type { Clock, IdGenerator } from '@gamedev-agent/events';
import { SystemClock, UuidGenerator } from '@gamedev-agent/events';
import type { Timestamp, UUID } from '@gamedev-agent/shared';
import { ContextValidationError } from './ContextErrors';
import type {
  AbsolutePath,
  BranchName,
  ContextId,
  ContextInit,
  CurrentContext,
  WorkflowExecutionId,
  WorkflowId,
} from './ContextTypes';
import { RECENT_FILES_LIMIT, RECENT_WORKFLOWS_LIMIT } from './ContextTypes';
import { assertValidContext, validateContextFields } from './ContextValidator';

/**
 * Builds immutable {@link CurrentContext} instances. Holds no state and performs
 * no I/O — it only translates raw inputs into validated aggregates using an
 * injected clock and id generator (so time/ids are deterministic in tests and
 * the factory never touches `Date.now()` or `crypto` directly).
 */

const defaultClock: Clock = SystemClock;
const defaultIds: IdGenerator = UuidGenerator;

/** Factory configuration. Clock/id generation are injectable for testing. */
export interface ContextFactoryOptions {
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
}

function asPath(value: string): AbsolutePath {
  return value as AbsolutePath;
}

/**
 * Produces {@link CurrentContext} aggregates and the patch operations that
 * derive the next immutable snapshot. The first context is created via
 * {@link initialize}; subsequent context states are produced by {@link withPatch}
 * and the recent-file / recent-workflow mutators.
 */
export class ContextFactory {
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;

  constructor(options: ContextFactoryOptions = {}) {
    this.clock = options.clock ?? defaultClock;
    this.idGenerator = options.idGenerator ?? defaultIds;
  }

  /**
   * Create the initial singleton context. The `id` is fixed for the session so
   * every event carries a stable `contextId`. An empty init (all `null`/`undefined`)
   * yields the onboarding state — Nova with nothing selected.
   */
  initialize(init: ContextInit = {}): CurrentContext {
    const id = this.idGenerator.generate() as UUID as ContextId;
    const now = this.clock.now() as Timestamp;

    const violations = validateContextFields({
      ...(init.recentFiles !== undefined ? { recentFiles: init.recentFiles } : {}),
      ...(init.recentWorkflows !== undefined ? { recentWorkflows: init.recentWorkflows } : {}),
      updatedAt: now,
    });
    if (violations.length > 0) {
      throw new ContextValidationError(violations);
    }

    const context: CurrentContext = {
      id,
      workspaceId: init.workspaceId ?? null,
      projectId: init.projectId ?? null,
      goalId: init.goalId ?? null,
      missionId: init.missionId ?? null,
      workflowId: init.workflowId ?? null,
      workflowExecutionId: init.workflowExecutionId ?? null,
      activeFile: init.activeFile ?? null,
      branch: init.branch ?? null,
      recentFiles: (init.recentFiles ?? []).map(asPath),
      recentWorkflows: (init.recentWorkflows ?? []).map((w) => w as WorkflowId),
      updatedAt: now,
    };
    assertValidContext(context);
    return context;
  }

  /**
   * Apply a partial patch to an existing context, returning a NEW aggregate with
   * a fresh `updatedAt` and re-validation. Nullable fields may be set to `null`
   * to clear them. `id` is preserved.
   */
  withPatch(existing: CurrentContext, patch: Partial<ContextInit>): CurrentContext {
    const next: CurrentContext = {
      ...existing,
      workspaceId:
        patch.workspaceId !== undefined ? (patch.workspaceId ?? null) : existing.workspaceId,
      projectId: patch.projectId !== undefined ? (patch.projectId ?? null) : existing.projectId,
      goalId: patch.goalId !== undefined ? (patch.goalId ?? null) : existing.goalId,
      missionId: patch.missionId !== undefined ? (patch.missionId ?? null) : existing.missionId,
      workflowId: patch.workflowId !== undefined ? (patch.workflowId ?? null) : existing.workflowId,
      workflowExecutionId:
        patch.workflowExecutionId !== undefined
          ? (patch.workflowExecutionId ?? null)
          : existing.workflowExecutionId,
      activeFile: patch.activeFile !== undefined ? (patch.activeFile ?? null) : existing.activeFile,
      branch: patch.branch !== undefined ? (patch.branch ?? null) : existing.branch,
      updatedAt: this.clock.now() as Timestamp,
    };
    assertValidContext(next);
    return next;
  }

  /**
   * Touch a file: move it to the front of recentFiles (de-duplicated) and keep
   * the ring bounded by {@link RECENT_FILES_LIMIT}.
   */
  withRecentFile(existing: CurrentContext, file: string): CurrentContext {
    const path = asPath(file);
    const recent = [path, ...existing.recentFiles.filter((f) => f !== path)].slice(
      0,
      RECENT_FILES_LIMIT as number,
    );
    return this.withRecentFiles(existing, recent, path);
  }

  /**
   * Commit a precomputed recent-files order and active file produced by the
   * {@link ContextHistory} ring. Keeps the factory as the single immutable
   * builder while the ordering policy lives in {@link ContextHistory}.
   */
  withRecentFiles(
    existing: CurrentContext,
    recentFiles: ReadonlyArray<AbsolutePath>,
    activeFile: AbsolutePath,
  ): CurrentContext {
    const next: CurrentContext = {
      ...existing,
      recentFiles,
      // activeFile is always the most recently touched entry
      activeFile,
      updatedAt: this.clock.now() as Timestamp,
    };
    assertValidContext(next);
    return next;
  }

  /**
   * Use a workflow: move it to the front of recentWorkflows (de-duplicated) and
   * keep the ring bounded by {@link RECENT_WORKFLOWS_LIMIT}.
   */
  withRecentWorkflow(existing: CurrentContext, workflowId: WorkflowId): CurrentContext {
    const recent = [workflowId, ...existing.recentWorkflows.filter((w) => w !== workflowId)].slice(
      0,
      RECENT_WORKFLOWS_LIMIT as number,
    );
    return this.withRecentWorkflows(existing, recent, workflowId);
  }

  /**
   * Commit a precomputed recent-workflows order produced by {@link ContextHistory}.
   */
  withRecentWorkflows(
    existing: CurrentContext,
    recentWorkflows: ReadonlyArray<WorkflowId>,
    workflowId: WorkflowId,
  ): CurrentContext {
    const next: CurrentContext = {
      ...existing,
      recentWorkflows,
      workflowId,
      updatedAt: this.clock.now() as Timestamp,
    };
    assertValidContext(next);
    return next;
  }

  /** Reset a context to the empty onboarding state (same id, refreshed time). */
  reset(existing: CurrentContext): CurrentContext {
    const next: CurrentContext = {
      ...existing,
      workspaceId: null,
      projectId: null,
      goalId: null,
      missionId: null,
      workflowId: null,
      workflowExecutionId: null,
      activeFile: null,
      branch: null,
      recentFiles: [],
      recentWorkflows: [],
      updatedAt: this.clock.now() as Timestamp,
    };
    assertValidContext(next);
    return next;
  }
}

export type { BranchName, WorkflowExecutionId };
