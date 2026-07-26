import { WorkspaceValidationError, type ValidationViolation } from './WorkspaceErrors';
import {
  validateUserPreferences,
  validateWorkspaceSettings,
  validateWorkspaceTheme,
} from './WorkspaceSettings';
import type {
  Workspace,
  WorkspaceInit,
  WorkspaceStatus,
} from './WorkspaceTypes';
import { WORKSPACE_STATUSES } from './WorkspaceTypes';

/**
 * Domain validation for the Nova Workspace System.
 *
 * Pure functions only — no I/O, no time, no ids. Validation is the single guard
 * at the boundary between untrusted input ({@link WorkspaceInit}) and the
 * trusted {@link Workspace} aggregate. The factory and manager both rely on it
 * so a malformed workspace can never enter the registry.
 */

const NAME_MAX = 200;
const DESCRIPTION_MAX = 4000;
const CAPABILITY_MAX = 512;
const TOOL_MAX = 512;
const ACTIVITY_MAX = 5000;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonSafe(value: unknown): boolean {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonSafe);
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(isJsonSafe);
  }
  return false;
}

/**
 * Validate the fields common to a creation request and a formed aggregate.
 * Returns the list of violations (empty when valid). Does not throw — callers
 * decide whether to raise {@link WorkspaceValidationError}.
 */
export function validateWorkspaceFields(input: WorkspaceInit): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (!isNonEmptyString(input.name)) {
    violations.push({
      field: 'name',
      reason: 'name is required and must be a non-empty string',
    });
  } else if (input.name.length > NAME_MAX) {
    violations.push({ field: 'name', reason: `name must be at most ${NAME_MAX} characters` });
  }

  if (
    input.description !== undefined &&
    (typeof input.description !== 'string' || input.description.length > DESCRIPTION_MAX)
  ) {
    violations.push({
      field: 'description',
      reason: `description must be a string of at most ${DESCRIPTION_MAX} characters`,
    });
  }

  if (
    input.projectIds !== undefined &&
    (!Array.isArray(input.projectIds) ||
      !input.projectIds.every((p) => {
        const asString = p as unknown as string;
        return typeof asString === 'string' && asString.length > 0;
      }))
  ) {
    violations.push({
      field: 'projectIds',
      reason: 'projectIds must be an array of non-empty strings',
    });
  }

  if (input.capabilities !== undefined) {
    if (!Array.isArray(input.capabilities)) {
      violations.push({ field: 'capabilities', reason: 'capabilities must be an array' });
    } else if (input.capabilities.length > CAPABILITY_MAX) {
      violations.push({
        field: 'capabilities',
        reason: `capabilities must not exceed ${CAPABILITY_MAX} entries`,
      });
    } else {
      input.capabilities.forEach((capability, index) => {
        if (typeof capability.id !== 'string' || capability.id.length === 0) {
          violations.push({
            field: `capabilities[${index}].id`,
            reason: 'capability id must be a non-empty string',
          });
        }
        if (typeof capability.enabled !== 'boolean') {
          violations.push({
            field: `capabilities[${index}].enabled`,
            reason: 'capability enabled must be a boolean',
          });
        }
        if (capability.options !== undefined && !isJsonSafe(capability.options)) {
          violations.push({
            field: `capabilities[${index}].options`,
            reason: 'capability options must be JSON-serializable',
          });
        }
      });
    }
  }

  if (input.tools !== undefined) {
    if (!Array.isArray(input.tools)) {
      violations.push({ field: 'tools', reason: 'tools must be an array' });
    } else if (input.tools.length > TOOL_MAX) {
      violations.push({ field: 'tools', reason: `tools must not exceed ${TOOL_MAX} entries` });
    } else {
      input.tools.forEach((tool, index) => {
        if (typeof tool.id !== 'string' || tool.id.length === 0) {
          violations.push({
            field: `tools[${index}].id`,
            reason: 'tool id must be a non-empty string',
          });
        }
        if (typeof tool.name !== 'string' || tool.name.length === 0) {
          violations.push({
            field: `tools[${index}].name`,
            reason: 'tool name must be a non-empty string',
          });
        }
        if (typeof tool.category !== 'string' || tool.category.length === 0) {
          violations.push({
            field: `tools[${index}].category`,
            reason: 'tool category must be a non-empty string',
          });
        }
        if (
          !['connected', 'disconnected', 'error', 'pending'].includes(tool.status)
        ) {
          violations.push({
            field: `tools[${index}].status`,
            reason: 'tool status must be one of connected/disconnected/error/pending',
          });
        }
        if (tool.config !== undefined && !isJsonSafe(tool.config)) {
          violations.push({
            field: `tools[${index}].config`,
            reason: 'tool config must be JSON-serializable',
          });
        }
      });
    }
  }

  if (
    input.metadata !== undefined &&
    (!isPlainObject(input.metadata) || !isJsonSafe(input.metadata))
  ) {
    violations.push({ field: 'metadata', reason: 'metadata must be JSON-serializable' });
  }

  violations.push(...validateUserPreferences(input.preferences));
  violations.push(...validateWorkspaceTheme(input.theme));
  // Settings are not part of WorkspaceInit (they are managed by the workspace
  // itself), but we keep the validator forward-compatible by accepting them.

  return violations;
}

/** Validate a fully-formed {@link Workspace} aggregate (used on load/update). */
export function validateWorkspace(workspace: Workspace): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (!WORKSPACE_STATUSES.includes(workspace.status as WorkspaceStatus)) {
    violations.push({
      field: 'status',
      reason: `status must be one of: ${WORKSPACE_STATUSES.join(', ')}`,
    });
  }
  if (typeof workspace.createdAt !== 'number' || !Number.isFinite(workspace.createdAt)) {
    violations.push({ field: 'createdAt', reason: 'createdAt must be a finite timestamp' });
  }
  if (typeof workspace.updatedAt !== 'number' || !Number.isFinite(workspace.updatedAt)) {
    violations.push({ field: 'updatedAt', reason: 'updatedAt must be a finite timestamp' });
  } else if (workspace.updatedAt < workspace.createdAt) {
    violations.push({
      field: 'updatedAt',
      reason: 'updatedAt must not be earlier than createdAt',
    });
  }
  if (workspace.activity !== undefined && workspace.activity.length > ACTIVITY_MAX) {
    violations.push({
      field: 'activity',
      reason: `activity must not exceed ${ACTIVITY_MAX} entries`,
    });
  }

  const init: WorkspaceInit = {
    name: workspace.name,
    description: workspace.description,
    projectIds: workspace.projectIds,
    capabilities: workspace.capabilities,
    tools: workspace.tools,
    preferences: workspace.preferences,
    theme: workspace.theme,
    metadata: workspace.metadata,
  };
  violations.push(...validateWorkspaceFields(init));
  return violations;
}

/** Throw a {@link WorkspaceValidationError} if the workspace is invalid. */
export function assertValidWorkspace(workspace: Workspace): void {
  const violations = validateWorkspace(workspace);
  if (violations.length > 0) {
    throw new WorkspaceValidationError(violations);
  }
}

export { validateWorkspaceSettings };
