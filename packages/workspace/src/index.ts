/**
 * Nova Workspace System — public API.
 *
 * The Workspace System is the **highest-level persistent object** of Nova. A
 * Workspace represents an entire Game Development Studio and owns every other
 * concern: its {@link Workspace} aggregate references the Projects it contains,
 * the Capabilities it has installed, the Tools it has connected, the user's
 * Preferences, the active Theme, its recent Activity, and arbitrary Metadata.
 *
 * This barrel exposes the stable surface that applications and future packages
 * depend on. Internal modules are not exported.
 */

// --- Domain model & types ---------------------------------------------------
export type {
  Workspace,
  WorkspaceId,
  WorkspaceInit,
  WorkspacePatch,
  WorkspaceStatus,
  InstalledCapability,
  ConnectedTool,
  ToolConnectionStatus,
  UserPreferences,
  WorkspaceTheme,
  WorkspaceActivity,
  WorkspaceMetadata,
} from './WorkspaceTypes';
export { WORKSPACE_STATUSES, DEFAULT_THEME, ACTIVITY_LIMIT } from './WorkspaceTypes';

// --- Errors -----------------------------------------------------------------
export {
  WorkspaceError,
  WorkspaceValidationError,
  WorkspaceStateError,
  WorkspaceNotFoundError,
  DuplicateWorkspaceError,
  WorkspaceConflictError,
  WorkspaceOwnershipError,
} from './WorkspaceErrors';
export type { ValidationViolation } from './WorkspaceErrors';

// --- Events (strongly typed) ------------------------------------------------
export {
  WorkspaceCreated,
  WorkspaceOpened,
  WorkspaceClosed,
  WorkspaceArchived,
  WorkspaceDeleted,
  WorkspaceRenamed,
  WorkspaceUpdated,
  WorkspaceProjectAdded,
  WorkspaceProjectRemoved,
} from './WorkspaceEvents';
export type {
  WorkspaceCreatedPayload,
  WorkspaceOpenedPayload,
  WorkspaceClosedPayload,
  WorkspaceArchivedPayload,
  WorkspaceDeletedPayload,
  WorkspaceRenamedPayload,
  WorkspaceUpdatedPayload,
  WorkspaceProjectAddedPayload,
  WorkspaceProjectRemovedPayload,
  WorkspaceEventPayloads,
} from './WorkspaceEvents';

// --- Settings ---------------------------------------------------------------
export type { WorkspaceSettings } from './WorkspaceSettings';
export {
  validateWorkspaceSettings,
  validateWorkspaceTheme,
  validateUserPreferences,
  withDefaultSettings,
  withDefaultTheme,
  withDefaultPreferences,
} from './WorkspaceSettings';

// --- Core components --------------------------------------------------------
export { WorkspaceFactory } from './WorkspaceFactory';
export type { WorkspaceFactoryOptions } from './WorkspaceFactory';
export { WorkspaceRegistry } from './WorkspaceRegistry';
export { WorkspaceManager } from './WorkspaceManager';
export type { WorkspaceManagerOptions } from './WorkspaceManager';

// --- Validation -------------------------------------------------------------
export {
  validateWorkspace,
  validateWorkspaceFields,
  assertValidWorkspace,
} from './WorkspaceValidator';

// --- Kernel integration -----------------------------------------------------
export { WORKSPACE_MANAGER_TOKEN, workspaceModule } from './WorkspaceModule';

// --- Convenience alias: the Studio API façade boundary ----------------------
export type { Workspace as StudioWorkspaceAggregate } from './WorkspaceTypes';
