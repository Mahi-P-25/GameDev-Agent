/**
 * Nova Capability Framework — public API.
 *
 * Capabilities own an *action*; Roles own *responsibilities* and *compose*
 * capabilities (see README). This package implements the framework only — it
 * performs no AI, Memory, Knowledge, Planning, or Role execution, and it does
 * not launch real external programs. Concrete capabilities are typed stubs that
 * future sprints back with real integrations behind the same contract.
 *
 * Integration surface is deliberately narrow: only the Kernel (via the
 * {@link capabilityModule} KernelModule + DI token), the Coordinator (which
 * resolves the manager and observes events), and the shared Event Bus. No
 * package is imported or called directly.
 */

// --- core contracts ----------------------------------------------------------
export type {
  CapabilityId,
  CapabilityCategory,
  CapabilityPermission,
  CapabilityHealth,
  CapabilityDescriptor,
  CapabilityParameter,
  CapabilityContext as CapabilityContextContract,
  CapabilityResult,
  CapabilityErrorInfo,
  Platform,
  RequiredTool,
} from './CapabilityDescriptor';
export { asCapabilityId } from './CapabilityDescriptor';

// --- capability abstraction --------------------------------------------------
export type { Capability } from './Capability';
export { BaseCapability } from './Capability';
export { CapabilityContextImpl as CapabilityContext } from './CapabilityContext';

// --- tool probing (future-integration seam) ----------------------------------
export type { ToolProbe } from './ToolProbe';
export { NoopToolProbe } from './ToolProbe';

// --- lifecycle + registry + manager ------------------------------------------
export { CapabilityRegistry } from './CapabilityRegistry';
export { CapabilityManager } from './CapabilityManager';
export type { CapabilityManagerOptions } from './CapabilityManager';
export {
  CAPABILITY_MANAGER_TOKEN,
  capabilityModule,
} from './CapabilityModule';

// --- errors ------------------------------------------------------------------
export {
  CapabilityError,
  CapabilityNotFoundError,
  CapabilityDisabledError,
  DuplicateCapabilityError,
  UnsupportedPlatformError,
  PermissionDeniedError,
  ToolUnavailableError,
  CapabilityInputError,
  CapabilityExecutionError,
} from './CapabilityErrors';
export type { ValidationViolation } from './CapabilityErrors';

// --- events ------------------------------------------------------------------
export {
  CapabilityRegistered,
  CapabilityEnabled,
  CapabilityDisabled,
  CapabilityRequested,
  CapabilityStarted,
  CapabilityCompleted,
  CapabilityFailed,
  CapabilityHealthChanged,
} from './CapabilityEvents';
export type {
  CapabilityRegisteredPayload,
  CapabilityEnabledPayload,
  CapabilityDisabledPayload,
  CapabilityRequestedPayload,
  CapabilityStartedPayload,
  CapabilityCompletedPayload,
  CapabilityFailedPayload,
  CapabilityHealthChangedPayload,
  CapabilityEventPayloads,
} from './CapabilityEvents';

// --- built-in example capabilities (SPRINT-6 typed stubs) --------------------
export { BUILT_IN_CAPABILITIES } from './examples';
export { VSCodeCapability, VSCODE_DESCRIPTOR } from './examples/VSCodeCapability';
export { GitCapability, GIT_DESCRIPTOR } from './examples/GitCapability';
export { FilesystemCapability, FILESYSTEM_DESCRIPTOR } from './examples/FilesystemCapability';
export { TerminalCapability, TERMINAL_DESCRIPTOR } from './examples/TerminalCapability';
export { BrowserCapability, BROWSER_DESCRIPTOR } from './examples/BrowserCapability';
export { BlenderCapability, BLENDER_DESCRIPTOR } from './examples/BlenderCapability';
export { ThreeJsCapability, THREE_JS_DESCRIPTOR } from './examples/ThreeJsCapability';
