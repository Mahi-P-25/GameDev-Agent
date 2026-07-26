import type { Json } from '@gamedev-agent/shared';
import type { ValidationViolation } from './WorkspaceErrors';
import type { UserPreferences, WorkspaceTheme } from './WorkspaceTypes';
import { DEFAULT_THEME } from './WorkspaceTypes';

/**
 * Workspace Settings — the technical/operational configuration of a Workspace.
 *
 * Where {@link UserPreferences} capture personalization (locale, telemetry
 * opt-in), *settings* capture the studio-level operating choices that Nova's
 * own subsystems read: the default engine, the workspace-wide memory/knowledge
 * scopes that future packages will fill, and free-form, JSON-serializable
 * options. A Workspace owns its settings; they travel with the aggregate and
 * are persisted/replayed with it.
 *
 * This structure is intentionally open (`options`) so new studio capabilities
 * (e.g. remote build farms, asset CDNs) can attach configuration without a
 * schema migration, while the first-class fields stay fully typed for the
 * well-known concerns.
 */

/** Studio-level operating settings owned by a Workspace. */
export interface WorkspaceSettings {
  /** Default engine id the workspace targets when none is specified per-project. */
  readonly defaultEngine?: string;
  /** Whether the workspace participates in distributed/Nova-cloud collaboration. */
  readonly collaborationEnabled?: boolean;
  /** Whether auto-save of workspace state is enabled. */
  readonly autoSaveEnabled?: boolean;
  /** Bounded retention window (days) for activity history; 0 = unbounded. */
  readonly activityRetentionDays?: number;
  /** Arbitrary, subsystem-defined settings bag. Must be JSON-serializable. */
  readonly options?: Readonly<Record<string, Json>>;
}

/** Validate a {@link WorkspaceSettings} value. Returns violations (empty = valid). */
export function validateWorkspaceSettings(
  settings: unknown,
): ReadonlyArray<ValidationViolation> {
  const violations: ValidationViolation[] = [];
  if (settings === undefined) {
    return violations;
  }
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
    violations.push({ field: 'settings', reason: 'settings must be an object' });
    return violations;
  }

  const record = settings as Record<string, unknown>;
  if (
    record.defaultEngine !== undefined &&
    (typeof record.defaultEngine !== 'string' || record.defaultEngine.length === 0)
  ) {
    violations.push({
      field: 'settings.defaultEngine',
      reason: 'defaultEngine must be a non-empty string',
    });
  }
  if (
    record.collaborationEnabled !== undefined &&
    typeof record.collaborationEnabled !== 'boolean'
  ) {
    violations.push({
      field: 'settings.collaborationEnabled',
      reason: 'collaborationEnabled must be a boolean',
    });
  }
  if (
    record.autoSaveEnabled !== undefined &&
    typeof record.autoSaveEnabled !== 'boolean'
  ) {
    violations.push({
      field: 'settings.autoSaveEnabled',
      reason: 'autoSaveEnabled must be a boolean',
    });
  }
  if (record.activityRetentionDays !== undefined) {
    if (
      typeof record.activityRetentionDays !== 'number' ||
      !Number.isFinite(record.activityRetentionDays) ||
      record.activityRetentionDays < 0
    ) {
      violations.push({
        field: 'settings.activityRetentionDays',
        reason: 'activityRetentionDays must be a non-negative number',
      });
    }
  }
  return violations;
}

/**
 * Normalize partial settings into a complete, defaulted settings object. Used by
 * the factory and manager so a Workspace always carries a real settings value.
 */
export function withDefaultSettings(
  partial: WorkspaceSettings | undefined,
): WorkspaceSettings {
  if (partial === undefined) {
    return {};
  }
  return { ...partial };
}

/** Validate a theme value, returning violations (empty = valid). */
export function validateWorkspaceTheme(theme: unknown): ReadonlyArray<ValidationViolation> {
  const violations: ValidationViolation[] = [];
  if (theme === undefined) {
    return violations;
  }
  if (typeof theme !== 'object' || theme === null || Array.isArray(theme)) {
    violations.push({ field: 'theme', reason: 'theme must be an object' });
    return violations;
  }
  const record = theme as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.trim().length === 0) {
    violations.push({ field: 'theme.id', reason: 'theme.id must be a non-empty string' });
  }
  if (record.accent !== undefined && typeof record.accent !== 'string') {
    violations.push({ field: 'theme.accent', reason: 'theme.accent must be a string' });
  }
  return violations;
}

/** Normalize a partial theme into a complete theme, applying the default. */
export function withDefaultTheme(partial: WorkspaceTheme | undefined): WorkspaceTheme {
  if (partial === undefined) {
    return DEFAULT_THEME;
  }
  const id = partial.id.trim().length > 0 ? partial.id : DEFAULT_THEME.id;
  if (partial.accent === undefined) {
    return { id };
  }
  return { id, accent: partial.accent };
}

/** Validate user preferences, returning violations (empty = valid). */
export function validateUserPreferences(
  preferences: unknown,
): ReadonlyArray<ValidationViolation> {
  const violations: ValidationViolation[] = [];
  if (preferences === undefined) {
    return violations;
  }
  if (typeof preferences !== 'object' || preferences === null || Array.isArray(preferences)) {
    violations.push({ field: 'preferences', reason: 'preferences must be an object' });
    return violations;
  }
  const record = preferences as Record<string, unknown>;
  if (record.locale !== undefined && typeof record.locale !== 'string') {
    violations.push({ field: 'preferences.locale', reason: 'locale must be a string' });
  }
  if (record.telemetryEnabled !== undefined && typeof record.telemetryEnabled !== 'boolean') {
    violations.push({
      field: 'preferences.telemetryEnabled',
      reason: 'telemetryEnabled must be a boolean',
    });
  }
  if (record.assistantEnabled !== undefined && typeof record.assistantEnabled !== 'boolean') {
    violations.push({
      field: 'preferences.assistantEnabled',
      reason: 'assistantEnabled must be a boolean',
    });
  }
  return violations;
}

/** Normalize partial preferences into a complete, defaulted object. */
export function withDefaultPreferences(
  partial: UserPreferences | undefined,
): UserPreferences {
  if (partial === undefined) {
    return {};
  }
  return { ...partial };
}
