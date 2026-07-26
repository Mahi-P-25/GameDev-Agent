import { ProjectValidationError, type ValidationViolation } from './ProjectErrors';
import { ENGINES, PROJECT_STATUSES, type Project, type ProjectInit } from './ProjectTypes';

/**
 * Domain validation for the Nova Project System.
 *
 * Pure functions only — no I/O, no time, no ids. Validation is the single guard
 * at the boundary between untrusted input ({@link ProjectInit}) and the trusted
 * {@link Project} aggregate. The factory and manager both rely on it so a
 * malformed project can never enter the registry.
 */

const NAME_MAX = 200;
const PATH_MAX = 4096;
const TAG_MAX = 50;
const TAG_COUNT_MAX = 64;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate the fields common to an initialized project and a creation request.
 * Returns the list of violations (empty when valid). Does not throw — callers
 * decide whether to raise {@link ProjectValidationError}.
 */
export function validateProjectFields(input: ProjectInit): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (!isNonEmptyString(input.name)) {
    violations.push({ field: 'name', reason: 'name is required and must be a non-empty string' });
  } else if (input.name.length > NAME_MAX) {
    violations.push({
      field: 'name',
      reason: `name must be at most ${NAME_MAX} characters`,
    });
  }

  if (!isNonEmptyString(input.rootPath)) {
    violations.push({
      field: 'rootPath',
      reason: 'rootPath is required and must be a non-empty string',
    });
  } else if (input.rootPath.length > PATH_MAX) {
    violations.push({
      field: 'rootPath',
      reason: `rootPath must be at most ${PATH_MAX} characters`,
    });
  }

  if (input.engine !== undefined && !ENGINES.includes(input.engine)) {
    violations.push({
      field: 'engine',
      reason: `engine must be one of: ${ENGINES.join(', ')}`,
    });
  }

  if (
    input.targetPlatforms !== undefined &&
    (!Array.isArray(input.targetPlatforms) ||
      !input.targetPlatforms.every((p) => typeof p === 'string' && p.length > 0))
  ) {
    violations.push({
      field: 'targetPlatforms',
      reason: 'targetPlatforms must be an array of non-empty strings',
    });
  }

  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags)) {
      violations.push({ field: 'tags', reason: 'tags must be an array of strings' });
    } else {
      if (input.tags.length > TAG_COUNT_MAX) {
        violations.push({
          field: 'tags',
          reason: `tags must not exceed ${TAG_COUNT_MAX} entries`,
        });
      }
      for (const tag of input.tags) {
        if (typeof tag !== 'string' || tag.length === 0 || tag.length > TAG_MAX) {
          violations.push({
            field: 'tags',
            reason: `each tag must be a non-empty string of at most ${TAG_MAX} characters`,
          });
          break;
        }
      }
    }
  }

  if (
    input.metadata !== undefined &&
    (!isPlainObject(input.metadata) || !isJsonSafe(input.metadata))
  ) {
    violations.push({ field: 'metadata', reason: 'metadata must be JSON-serializable' });
  }

  if (input.description !== undefined && typeof input.description !== 'string') {
    violations.push({ field: 'description', reason: 'description must be a string' });
  }

  validateSubConfig(input.workspace, 'workspace', violations);
  validateGitConfig(input.git, violations);
  validatePluginConfig(input.plugins, violations);
  validateModelConfig(input.model, violations);

  return violations;
}

function validateSubConfig(
  config: unknown,
  field: string,
  violations: ValidationViolation[],
): void {
  if (config === undefined) {
    return;
  }
  if (!isPlainObject(config)) {
    violations.push({ field, reason: `${field} must be an object` });
  }
}

function validateGitConfig(git: unknown, violations: ValidationViolation[]): void {
  if (git === undefined) {
    return;
  }
  if (!isPlainObject(git) || typeof (git as { enabled?: unknown }).enabled !== 'boolean') {
    violations.push({ field: 'git.enabled', reason: 'git.enabled must be a boolean' });
  }
}

function validatePluginConfig(plugins: unknown, violations: ValidationViolation[]): void {
  if (plugins === undefined) {
    return;
  }
  if (!isPlainObject(plugins) || !Array.isArray((plugins as { enabled?: unknown }).enabled)) {
    violations.push({ field: 'plugins.enabled', reason: 'plugins.enabled must be an array' });
  }
}

function validateModelConfig(model: unknown, violations: ValidationViolation[]): void {
  if (model === undefined) {
    return;
  }
  if (!isPlainObject(model)) {
    violations.push({ field: 'model', reason: 'model must be an object' });
  }
}

/** Validate a fully-formed {@link Project} aggregate (used on load/update). */
export function validateProject(project: Project): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  if (!PROJECT_STATUSES.includes(project.status)) {
    violations.push({
      field: 'status',
      reason: `status must be one of: ${PROJECT_STATUSES.join(', ')}`,
    });
  }
  if (typeof project.createdAt !== 'number' || !Number.isFinite(project.createdAt)) {
    violations.push({ field: 'createdAt', reason: 'createdAt must be a finite timestamp' });
  }
  if (typeof project.updatedAt !== 'number' || !Number.isFinite(project.updatedAt)) {
    violations.push({ field: 'updatedAt', reason: 'updatedAt must be a finite timestamp' });
  } else if (project.updatedAt < project.createdAt) {
    violations.push({
      field: 'updatedAt',
      reason: 'updatedAt must not be earlier than createdAt',
    });
  }

  const init: ProjectInit = {
    name: project.name,
    description: project.description,
    rootPath: project.rootPath,
    engine: project.engine,
    targetPlatforms: project.targetPlatforms,
    tags: project.tags,
    metadata: project.metadata,
    workspace: project.workspace,
    git: project.git,
    plugins: project.plugins,
    model: project.model,
  };
  violations.push(...validateProjectFields(init));
  return violations;
}

/** Throw a {@link ProjectValidationError} if the project is invalid. */
export function assertValidProject(project: Project): void {
  const violations = validateProject(project);
  if (violations.length > 0) {
    throw new ProjectValidationError(violations);
  }
}

/** JSON-serializability check (no functions, no `undefined`, no bigint/symbol). */
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
