/**
 * Nova Project System — public API.
 *
 * The Project System is the root object of Nova. Every other subsystem
 * (Memory, Knowledge, Missions, Plugins, Model configuration, Workspaces, Git)
 * belongs to a {@link Project}. This barrel exposes the stable surface that
 * applications and future packages depend on. Internal modules are not exported.
 */

// --- Domain model & types ---------------------------------------------------
export type {
  Project,
  ProjectId,
  ProjectInit,
  ProjectPatch,
  ProjectStatus,
  Engine,
  TargetPlatform,
  ProgrammingLanguage,
  MemoryNamespace,
  KnowledgeNamespace,
  MissionNamespace,
  WorkspaceConfiguration,
  GitConfiguration,
  PluginConfiguration,
  ModelConfiguration,
  ProjectMetadata,
} from './ProjectTypes';
export { PROJECT_STATUSES, ENGINES } from './ProjectTypes';

// --- Errors -----------------------------------------------------------------
export {
  ProjectError,
  ProjectValidationError,
  ProjectStateError,
  ProjectNotFoundError,
  DuplicateProjectError,
  ProjectConflictError,
} from './ProjectErrors';
export type { ValidationViolation } from './ProjectErrors';

// --- Events (strongly typed) ------------------------------------------------
export {
  ProjectCreated,
  ProjectOpened,
  ProjectClosed,
  ProjectRenamed,
  ProjectUpdated,
  ProjectDeleted,
} from './ProjectEvents';
export type {
  ProjectCreatedPayload,
  ProjectOpenedPayload,
  ProjectClosedPayload,
  ProjectRenamedPayload,
  ProjectUpdatedPayload,
  ProjectDeletedPayload,
} from './ProjectEvents';

// --- Core components --------------------------------------------------------
export { ProjectFactory } from './ProjectFactory';
export type { ProjectFactoryOptions } from './ProjectFactory';
export { ProjectRegistry } from './ProjectRegistry';
export { ProjectManager } from './ProjectManager';
export type { ProjectManagerOptions } from './ProjectManager';

// --- Validation -------------------------------------------------------------
export {
  validateProject,
  validateProjectFields,
  assertValidProject,
} from './ProjectValidator';
export { slugify } from './ProjectFactory';

// --- Kernel integration -----------------------------------------------------
export { PROJECT_MANAGER_TOKEN, projectModule } from './ProjectModule';
