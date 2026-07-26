import type { Clock, IdGenerator } from '@gamedev-agent/events';
import { SystemClock, UuidGenerator } from '@gamedev-agent/events';
import type { Timestamp, UUID } from '@gamedev-agent/shared';
import type { ValidationViolation } from './WorkspaceErrors';
import { WorkspaceValidationError } from './WorkspaceErrors';
import {
  validateWorkspace,
  validateWorkspaceFields,
} from './WorkspaceValidator';
import {
  validateUserPreferences,
  validateWorkspaceTheme,
  withDefaultPreferences,
  withDefaultSettings,
  withDefaultTheme,
} from './WorkspaceSettings';
import { ACTIVITY_LIMIT } from './WorkspaceTypes';
import type {
  Workspace,
  WorkspaceId,
  WorkspaceInit,
  WorkspacePatch,
  WorkspaceStatus,
} from './WorkspaceTypes';
import { assertValidWorkspace } from './WorkspaceValidator';

/**
 * Production clock/id primitives reused from the events package so the Workspace
 * System shares one source of truth for time and identity with the rest of Nova.
 */
const defaultClock: Clock = SystemClock;
const defaultIds: IdGenerator = UuidGenerator;

/**
 * Constructs {@link Workspace} aggregates.
 *
 * The factory is the *only* place that assembles a raw {@link Workspace} object,
 * which keeps construction rules (default values, id/time stamping, validation,
 * activity bounding) in one testable unit. `Clock` and `IdGenerator` are
 * injected so tests get deterministic ids/timestamps and so the factory never
 * touches `Date.now()` / `crypto` directly (matching the kernel/events/project
 * pattern).
 *
 * The factory is pure: it neither registers nor emits. Orchestration (events,
 * registry, project ownership) lives in {@link WorkspaceManager}.
 */
export interface WorkspaceFactoryOptions {
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
}

export class WorkspaceFactory {
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;

  constructor(options: WorkspaceFactoryOptions = {}) {
    this.clock = options.clock ?? defaultClock;
    this.idGenerator = options.idGenerator ?? defaultIds;
  }

  /** Create a brand-new workspace from a request, applying defaults + validation. */
  create(init: WorkspaceInit): Workspace {
    const violations = validateWorkspaceFields(init);
    if (violations.length > 0) {
      throw new WorkspaceValidationError(violations);
    }

    const now = this.clock.now() as Timestamp;
    const id = this.idGenerator.generate() as UUID as WorkspaceId;

    const workspace: Workspace = {
      id,
      name: init.name.trim(),
      description: init.description?.trim() ?? '',
      projectIds: init.projectIds ? [...init.projectIds] : [],
      capabilities: init.capabilities ? [...init.capabilities] : [],
      tools: init.tools ? [...init.tools] : [],
      preferences: withDefaultPreferences(init.preferences),
      theme: withDefaultTheme(init.theme),
      activity: [],
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      metadata: init.metadata ?? {},
    };

    assertValidWorkspace(workspace);
    return workspace;
  }

  /**
   * Apply a patch to an existing, validated workspace, returning a *new*
   * aggregate (immutability — the original is never mutated). Re-stamps
   * `updatedAt` and re-validates. `createdAt`, `id`, `status`, `projectIds`,
   * and `activity` are preserved by a generic field patch.
   */
  update(existing: Workspace, patch: WorkspacePatch): Workspace {
    const merged: Workspace = {
      ...existing,
      name: patch.name?.trim() ?? existing.name,
      description: patch.description?.trim() ?? existing.description,
      capabilities: patch.capabilities ? [...patch.capabilities] : existing.capabilities,
      tools: patch.tools ? [...patch.tools] : existing.tools,
      preferences: { ...existing.preferences, ...patch.preferences },
      theme: patch.theme ? withDefaultTheme(patch.theme) : existing.theme,
      metadata: patch.metadata ?? existing.metadata,
      updatedAt: this.clock.now() as Timestamp,
    };

    const violations = validateWorkspace(merged);
    if (violations.length > 0) {
      throw new WorkspaceValidationError(violations);
    }
    return merged;
  }

  /**
   * Produce a copy of an existing workspace with a new lifecycle status. Used by
   * the manager to transition `draft → open → closed → archived` without
   * re-validating the entire aggregate (status is constrained by the caller).
   */
  withStatus(existing: Workspace, status: WorkspaceStatus): Workspace {
    return { ...existing, status, updatedAt: this.clock.now() as Timestamp };
  }

  /**
   * Add a project reference to a workspace, returning a new aggregate. Idempotent
   * at the value level (no duplicate id is introduced). Used by the manager,
   * which enforces ownership invariants before calling this.
   */
  withProject(existing: Workspace, projectId: Workspace['projectIds'][number]): Workspace {
    if (existing.projectIds.includes(projectId)) {
      return existing;
    }
    const next: Workspace = {
      ...existing,
      projectIds: [...existing.projectIds, projectId],
      updatedAt: this.clock.now() as Timestamp,
    };
    this.assertBounded(next);
    return next;
  }

  /**
   * Remove a project reference from a workspace, returning a new aggregate.
   * Idempotent at the value level (removing an absent id returns the same
   * instance). Used by the manager, which enforces ownership invariants.
   */
  withoutProject(existing: Workspace, projectId: Workspace['projectIds'][number]): Workspace {
    if (!existing.projectIds.includes(projectId)) {
      return existing;
    }
    const next: Workspace = {
      ...existing,
      projectIds: existing.projectIds.filter((id) => id !== projectId),
      updatedAt: this.clock.now() as Timestamp,
    };
    this.assertBounded(next);
    return next;
  }

  /** Append an activity entry, returning a new aggregate with a bounded list. */
  withActivity(
    existing: Workspace,
    entry: Workspace['activity'][number],
  ): Workspace {
    const next: Workspace = {
      ...existing,
      activity: boundActivity([...existing.activity, entry]),
      updatedAt: this.clock.now() as Timestamp,
    };
    return next;
  }

  // --- internals -------------------------------------------------------------

  private assertBounded(workspace: Workspace): void {
    const violations: ValidationViolation[] = validateWorkspace(workspace);
    if (violations.length > 0) {
      throw new WorkspaceValidationError(violations);
    }
  }
}

/** Cap the activity list at {@link ACTIVITY_LIMIT}, keeping the most recent. */
function boundActivity<T>(entries: ReadonlyArray<T>): ReadonlyArray<T> {
  if (entries.length <= ACTIVITY_LIMIT) {
    return entries;
  }
  return entries.slice(entries.length - ACTIVITY_LIMIT);
}

/** Re-export so callers can default settings/theme without importing internals. */
export {
  withDefaultSettings,
  withDefaultTheme,
  withDefaultPreferences,
  validateUserPreferences,
  validateWorkspaceTheme,
};
