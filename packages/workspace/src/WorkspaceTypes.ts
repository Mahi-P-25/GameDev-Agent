import type { Brand, Json, Timestamp, UUID } from '@gamedev-agent/shared';
import type { ProjectId } from '@gamedev-agent/project';

/**
 * The Workspace System is the **highest-level persistent object** of Nova.
 *
 * A Workspace represents an entire Game Development Studio. Everything in Nova
 * belongs to a Workspace: its {@link Project}s, the {@link InstalledCapability
 * capabilities} it has installed, the external {@link ConnectedTool tools} it has
 * connected, the user's {@link UserPreferences}, the active {@link WorkspaceTheme},
 * its {@link WorkspaceActivity recent activity}, and arbitrary {@link
 * WorkspaceMetadata}. Because a Workspace owns every other concern, it is the
 * aggregate root above Projects — Projects are no longer independent entities,
 * they exist only by reference within a Workspace.
 *
 * This module defines the full domain model, the enums that constrain it, and
 * the per-subsystem slots that future packages (Memory, Knowledge, Plugins, AI
 * Providers) will hang off of.
 */

/** Branded workspace identifier. Plain string at runtime, distinct at the type level. */
export type WorkspaceId = Brand<UUID, 'WorkspaceId'>;

/**
 * A workspace's lifecycle status. Drives which operations are permitted (e.g.
 * you cannot `open` an already-`open` workspace, nor `close` one that is not
 * `open`) and is surfaced on every workspace event.
 */
export type WorkspaceStatus = 'draft' | 'open' | 'closed' | 'archived';

/**
 * A capability the workspace has installed. The capability *system* itself
 * arrives later; this records what a workspace has enabled, the version bound,
 * and any capability-scoped options.
 */
export interface InstalledCapability {
  /** Capability id (e.g. `nova.coding`, `nova.asset-pipeline`). */
  readonly id: string;
  /** Semantic version of the installed capability, if known. */
  readonly version?: string;
  /** Whether the capability is currently active within the workspace. */
  readonly enabled: boolean;
  /** Capability-scoped options bag (must be JSON-serializable). */
  readonly options?: Readonly<Record<string, Json>>;
}

/**
 * An external tool connected to the workspace (e.g. a game engine build tool, a
 * version-control host, a DCC like Blender). Tools are references; the
 * integration runtime that drives them arrives later.
 */
export interface ConnectedTool {
  /** Tool id (stable, namespaced, e.g. `tool.unity-hub`). */
  readonly id: string;
  /** Human-readable name for display. */
  readonly name: string;
  /** Category of the tool (e.g. `engine`, `vcs`, `dcc`, `ci`). */
  readonly category: string;
  /** Connection status of the tool. */
  readonly status: ToolConnectionStatus;
  /** Arbitrary, tool-defined connection/configuration data. */
  readonly config?: Readonly<Record<string, Json>>;
}

/** Whether a connected tool is reachable and authenticated. */
export type ToolConnectionStatus = 'connected' | 'disconnected' | 'error' | 'pending';

/**
 * User preferences for the workspace. These are the per-studio personalization
 * settings (distinct from the technical {@link WorkspaceSettings}). Extensible
 * via {@link WorkspaceMetadata}.
 */
export interface UserPreferences {
  /** ISO locale for the workspace UI (e.g. `en-US`). */
  readonly locale?: string;
  /** Whether telemetry/analytics may be collected for this workspace. */
  readonly telemetryEnabled?: boolean;
  /** Whether the assistant may proactively act within the workspace. */
  readonly assistantEnabled?: boolean;
  /** Arbitrary, app-specific preference bag. */
  readonly custom?: Readonly<Record<string, Json>>;
}

/**
 * The visual theme of the workspace. Stored as a reference (built-in theme id or
 * a custom theme name) plus an optional accent so the UI has a single source of
 * truth for presentation.
 */
export interface WorkspaceTheme {
  /** Theme id: a built-in theme (`light` | `dark`) or a custom theme name. */
  readonly id: string;
  /** Optional accent color (hex) overriding the theme default. */
  readonly accent?: string;
}

/**
 * A single recent-activity entry. The workspace keeps a bounded, most-recent
 * list so the UI can show "what happened" without a separate subsystem.
 */
export interface WorkspaceActivity {
  /** Stable, monotonic-ish sequence within the workspace. */
  readonly id: string;
  /** Discriminator, e.g. `project.created`, `capability.installed`. */
  readonly kind: string;
  /** Human-readable message. */
  readonly message: string;
  /** Event time (ms since epoch). */
  readonly timestamp: Timestamp;
  /** Present when the activity concerns a project. */
  readonly projectId?: ProjectId;
  /** Present when the activity concerns a capability. */
  readonly capabilityId?: string;
  /** Present when the activity concerns a tool. */
  readonly toolId?: string;
}

/**
 * Arbitrary, schema-free workspace metadata. Used by future subsystems to attach
 * data without extending the core contract. Must be JSON-serializable so a
 * workspace can be persisted and replayed deterministically.
 */
export type WorkspaceMetadata = Readonly<Record<string, Json>>;

/**
 * The complete, immutable-at-rest Workspace aggregate. Instances are produced by
 * {@link WorkspaceFactory} and mutated only through the {@link WorkspaceManager}
 * (which returns new, validated instances — never mutates in place).
 */
export interface Workspace {
  readonly id: WorkspaceId;
  readonly name: string;
  readonly description: string;
  /** A workspace owns its Projects by reference (id → a Project it contains). */
  readonly projectIds: ReadonlyArray<ProjectId>;
  readonly capabilities: ReadonlyArray<InstalledCapability>;
  readonly tools: ReadonlyArray<ConnectedTool>;
  readonly preferences: UserPreferences;
  readonly theme: WorkspaceTheme;
  readonly activity: ReadonlyArray<WorkspaceActivity>;
  readonly status: WorkspaceStatus;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly metadata: WorkspaceMetadata;
}

/**
 * Input for creating a new workspace. Identifier, timestamps, status, and
 * activity are derived by the {@link WorkspaceFactory}; everything else is
 * provided by the caller (with sensible defaults applied by the factory).
 */
export interface WorkspaceInit {
  readonly name: string;
  readonly description?: string;
  /** Initial set of project references to seed the workspace with. */
  readonly projectIds?: ReadonlyArray<ProjectId>;
  readonly capabilities?: ReadonlyArray<InstalledCapability>;
  readonly tools?: ReadonlyArray<ConnectedTool>;
  readonly preferences?: UserPreferences;
  readonly theme?: WorkspaceTheme;
  readonly metadata?: WorkspaceMetadata;
}

/**
 * Patch applied during an update/rename. All fields optional; only the provided
 * fields are changed. `id`, `createdAt`, `status`, `activity`, and `projectIds`
 * are managed by the manager and cannot be patched directly through a generic
 * field patch (project ownership has dedicated methods).
 */
export interface WorkspacePatch {
  readonly name?: string;
  readonly description?: string;
  readonly capabilities?: ReadonlyArray<InstalledCapability>;
  readonly tools?: ReadonlyArray<ConnectedTool>;
  readonly preferences?: Partial<UserPreferences>;
  readonly theme?: WorkspaceTheme;
  readonly metadata?: WorkspaceMetadata;
}

/** Canonical identifiers for the well-known statuses, for validation & tooling. */
export const WORKSPACE_STATUSES: ReadonlyArray<WorkspaceStatus> = [
  'draft',
  'open',
  'closed',
  'archived',
];

/** The default theme applied to a newly created workspace. */
export const DEFAULT_THEME: WorkspaceTheme = { id: 'dark' };

/** Maximum number of activity entries retained per workspace (bounded ring). */
export const ACTIVITY_LIMIT = 200;

/**
 * Re-exported for callers that wish to type a handler against project references
 * sourced from the Project System.
 */
export type { ProjectId };
