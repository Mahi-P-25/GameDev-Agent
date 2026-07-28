import { createServiceToken } from '@gamedev-agent/di';
import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import type { Disposable, Json, Timestamp, UUID } from '@gamedev-agent/shared';
import type { ToolManager } from './ToolManager';

/**
 * DI token for the {@link ToolManager}. Resolving it yields the single,
 * kernel-scoped Tool Runtime instance. Registering twice throws a
 * `DuplicateServiceError` — the fail-fast behavior we want.
 */
export const TOOL_RUNTIME_TOKEN = createServiceToken<ToolManager>('nova.tool-runtime');

/**
 * Domain model and contracts for the Nova Tool Runtime.
 *
 * The Tool Runtime is the **single, consistent surface** through which Nova
 * discovers, connects to, monitors, and invokes every external tool (VS Code,
 * Git, Terminal, Browser, Blender, Unity, Godot, Unreal, …). No other subsystem
 * reaches a tool directly: the runtime owns registration, connection lifecycle,
 * health monitoring, the permission model, version metadata, capability
 * discovery, and invocation routing — and it audits every one of those actions.
 *
 * This module defines the public, stable shapes. It contains no logic — only
 * types and the {@link ToolHandler} contract a concrete tool adapter fulfills.
 */

/** Branded tool identifier. Plain string at runtime, distinct at the type level. */
export type ToolId = string & { readonly __brand: 'ToolId' };

/** Coerce a string into a {@link ToolId}. Purely a type-level assertion. */
export function asToolId(value: string): ToolId {
  return value as ToolId;
}

/** The coarse permission model shared with the Capability framework. */
export type ToolPermission =
  | 'fs.read'
  | 'fs.write'
  | 'fs.delete'
  | 'net.outbound'
  | 'net.inbound'
  | 'process.spawn'
  | 'process.kill'
  | 'system.env'
  | 'ui.open'
  | (string & {});

/** The platform a tool can run on. Mirrors the Capability framework's `Platform`. */
export type ToolPlatform = 'win32' | 'darwin' | 'linux' | 'web' | (string & {});

/** Functional grouping of tools, used for discovery and permission scoping. */
export type ToolCategory =
  | 'editor'
  | 'vcs'
  | 'shell'
  | 'browser'
  | '3d'
  | 'graphics'
  | 'build'
  | 'transport'
  | (string & {});

/**
 * A single, invokable capability a tool advertises. Each capability names the
 * actions it supports and the permissions those actions require, so the runtime
 * can route invocations and gate them without knowing the tool's internals.
 */
export interface ToolCapability {
  /** Stable, tool-scoped capability key (e.g. `filesystem`, `search`). */
  readonly id: string;
  /** Human-readable name. */
  readonly name: string;
  /** What this capability does, in one sentence. */
  readonly description: string;
  /** The action names routable under this capability. */
  readonly actions: ReadonlyArray<string>;
  /** Permissions required to invoke any action of this capability. */
  readonly permissions: ReadonlyArray<ToolPermission>;
}

/**
 * The static "tool card" — everything the runtime and Studio API need to
 * discover and route to a tool without the tool's implementation being known.
 */
export interface ToolDescriptor {
  /** Unique, stable, namespaced identifier (e.g. `nova.tool.vscode`). */
  readonly id: ToolId;
  /** Human-readable name. */
  readonly name: string;
  /** What the tool does, in one or two sentences. */
  readonly description: string;
  /** Semver of the tool integration. */
  readonly version: string;
  /** Functional grouping (see {@link ToolCategory}). */
  readonly category: ToolCategory;
  /** Permissions the tool may require across its capabilities. */
  readonly permissions: ReadonlyArray<ToolPermission>;
  /** Platforms the tool supports. */
  readonly supportedPlatforms: ReadonlyArray<ToolPlatform>;
  /** Capabilities the tool advertises (see {@link ToolCapability}). */
  readonly capabilities: ReadonlyArray<ToolCapability>;
  /** Connection kind: how the runtime reaches the tool. */
  readonly connection: ToolConnectionKind;
  /** Optional external binary/app the tool depends on (for health probing). */
  readonly requiredTools?: ReadonlyArray<{ readonly name: string; readonly minVersion?: string }>;
  /** Minimum Nova platform version this tool integration requires. */
  readonly minPlatformVersion?: string;
}

/** How a tool is reached by the runtime. */
export type ToolConnectionKind = 'process' | 'service' | 'embedded' | 'local';

/**
 * Connection state machine for a tool:
 *
 * ```
 * disconnected → connecting → connected → disconnecting → disconnected
 *                              ↘ error
 * ```
 */
export type ToolConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

/** A snapshot of a tool's connection at a point in time. */
export interface ToolConnection {
  readonly toolId: ToolId;
  readonly state: ToolConnectionState;
  /** When the current connection was established (ms since epoch), if connected. */
  readonly connectedAt: Timestamp | null;
  /** Last error message, when in `error` state. */
  readonly lastError: string | null;
  /** Arbitrary connection-specific metadata (e.g. endpoint, pid). */
  readonly metadata: Readonly<Record<string, Json>>;
}

/** Runtime health of a tool. Mirrors the Capability framework's `CapabilityHealth`. */
export type ToolHealth = 'unknown' | 'healthy' | 'degraded' | 'unhealthy';

/** A registered tool: its descriptor plus bookkeeping the runtime maintains. */
export interface ToolRegistration {
  readonly descriptor: ToolDescriptor;
  /** Current connection state. */
  readonly connection: ToolConnection;
  /** Last assessed health. */
  readonly health: ToolHealth;
  /** When the tool was registered (ms since epoch). */
  readonly registeredAt: Timestamp;
}

/** A request to invoke a tool action. */
export interface ToolInvocationRequest {
  /** The tool to invoke. */
  readonly toolId: ToolId;
  /** The capability/action to invoke, e.g. `filesystem.read`. */
  readonly action: string;
  /** Arbitrary, JSON-serializable input payload. */
  readonly input: Json;
  /** The actor on whose behalf the invocation runs (user / role / mission). */
  readonly actor: ToolActor;
  /** Correlation id linking the invocation to a Mission / run on the bus. */
  readonly correlationId: UUID | null;
  /** Optional abort signal (the runtime forwards it to the handler). */
  readonly signal?: AbortSignal;
}

/** The result of an invocation. Never throws for expected failures. */
export interface ToolInvocationResult {
  readonly ok: boolean;
  readonly toolId: ToolId;
  readonly action: string;
  /** Wall-clock duration of the invocation, in milliseconds. */
  readonly durationMs: number;
  /** Output payload. Present when `ok` is true; may be `null`. */
  readonly output: Json | null;
  /** Structured failure info. Present when `ok` is false. */
  readonly error?: { readonly code: string; readonly message: string; readonly cause?: unknown };
}

/**
 * The actor on whose behalf a tool operation runs. The runtime never acts on its
 * own initiative: every operation names an explicit actor so the audit trail is
 * unambiguous (mirrors the VS Code integration's {@link ToolActor} shape).
 */
export interface ToolActor {
  /** Human or system label, e.g. `director`, `role:gameplay-engineer`. */
  readonly kind: string;
  /** Optional stable id (user id, role id, mission id). */
  readonly id?: string;
}

/**
 * The contract every concrete tool adapter fulfills. The Tool Runtime talks to a
 * tool *only* through this interface — connection, health, capability
 * discovery, and invocation are all delegated here. Adapters are tiny: they
 * wrap an existing client (e.g. {@link VSCodeClient}) and translate actions.
 */
export interface ToolHandler {
  /** Establish the connection. Idempotent: a no-op if already connected. */
  connect(config?: Readonly<Record<string, Json>>): Promise<void>;
  /** Tear down the connection. Safe to call when already disconnected. */
  disconnect(): Promise<void>;
  /** Whether the handler currently holds a live connection. */
  isConnected(): boolean;
  /** Assess current health (tool availability, connectivity, …). */
  health(): Promise<ToolHealth>;
  /** The capabilities this handler currently advertises. */
  capabilities(): ReadonlyArray<ToolCapability>;
  /**
   * Invoke an action. The runtime has already routed, permission-checked, and
   * audited the call; the handler performs the action and returns a result.
   */
  invoke(
    action: string,
    input: Json,
    context: ToolInvocationContext,
  ): Promise<ToolInvocationResult>;
}

/** Per-invocation context handed to a {@link ToolHandler}. */
export interface ToolInvocationContext {
  readonly correlationId: UUID | null;
  readonly signal?: AbortSignal;
}

/** One line in the runtime's immutable audit trail. */
export interface ToolAuditRecord {
  /** Monotonic, per-manager sequence number. */
  readonly seq: number;
  /** Stable discriminator, e.g. `tool.registered`, `tool.invoked`. */
  readonly kind: string;
  /** The tool the operation targeted, when applicable. */
  readonly toolId?: ToolId;
  /** The action invoked, when applicable. */
  readonly action?: string;
  /** The actor on whose behalf the operation ran. */
  readonly actor: ToolActor;
  /** Correlation id linking the operation to a Mission / run on the bus. */
  readonly correlationId: UUID | null;
  /** Whether the operation succeeded. */
  readonly ok: boolean;
  /** Present when `ok` is false. */
  readonly error?: string;
  /** Event time (ms since epoch). */
  readonly timestamp: Timestamp;
}

/** Options for the {@link ToolManager}. Depends only on abstractions. */
export interface ToolManagerOptions {
  /** Shared Nova Event Bus. Required; the manager emits tool events here. */
  readonly eventBus: EventBusContract;
  /** Namespaced logger. A console-backed root logger is the default. */
  readonly logger?: Logger;
  /** The host platform; defaults to `process.platform`. */
  readonly platform?: ToolPlatform;
  /** Permissions granted to the running host; gates invocation. */
  readonly grantedPermissions?: ReadonlyArray<ToolPermission>;
  /**
   * Optional Capabilities integration. When supplied, each registered tool is
   * advertised as a {@link CapabilityDescriptor} so the Studio API (which reads
   * the Capability Manager) can surface tools for discovery. This is the only
   * coupling to the Capabilities subsystem and it is a read-only, advertise-only
   * seam — the runtime never executes capabilities itself.
   */
  readonly capabilities?: CapabilitiesLink;
  /**
   * Optional Coordinator integration. When supplied, invocations are linked to a
   * Mission via `correlationId` so the operation is observable in the
   * Coordinator's event stream. Read-only, capability-scoped seam.
   */
  readonly coordinator?: CoordinatorLink;
  /** Health-monitoring poll interval, in milliseconds. Default 30_000. */
  readonly healthCheckIntervalMs?: number;
}

/**
 * The narrow seam the runtime uses to advertise tools into the Capability
 * framework. Implemented by the {@link ToolModule} against the
 * `CapabilityManager`; the runtime depends on the interface, not the concrete
 * manager, so it stays independently testable.
 */
export interface CapabilitiesLink {
  /** Advertise a tool as a capability. Safe to call when already advertised. */
  advertise(descriptor: CapabilityDescriptorLike): void;
  /** Withdraw a previously advertised tool capability. */
  withdraw(toolId: ToolId): void;
}

/** Structural subset of `CapabilityDescriptor` the runtime produces. */
export interface CapabilityDescriptorLike {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly category: string;
  readonly permissions: ReadonlyArray<string>;
  readonly supportedPlatforms: ReadonlyArray<string>;
  readonly requiredTools: ReadonlyArray<{ readonly name: string; readonly minVersion?: string }>;
  readonly inputs: ReadonlyArray<unknown>;
  readonly outputs: ReadonlyArray<unknown>;
}

/**
 * The narrow seam the runtime uses to participate in the Coordinator's mission
 * stream. We depend on the interface, not the concrete {@link CoordinatorManager},
 * so the package stays independently testable.
 */
export interface CoordinatorLink {
  /** Resolve the mission id for a correlation id, if known. */
  resolveMission(correlationId: UUID): { readonly missionId: string } | null;
}

// --- Tool Orchestrator types ---------------------------------------------------

/**
 * Functional categories for game-development tool capabilities.
 * More granular than the coarse {@link ToolCategory} used for discovery.
 */
export type CapabilityCategory =
  | 'filesystem'
  | 'vcs'
  | 'shell'
  | 'editor'
  | '3d'
  | 'game-engine'
  | 'browser'
  | 'asset-pipeline'
  | 'build'
  | 'test'
  | 'network'
  | (string & {});

/**
 * Abstract ability a mission requires — never coupled to a concrete tool.
 * The Mission Planner emits these; the Capability Planner resolves them
 * to specific tool capabilities at execution time.
 */
export type MissionAbility =
  | 'read-files'
  | 'write-files'
  | 'edit-files'
  | 'list-files'
  | 'delete-files'
  | 'rename-files'
  | 'run-commands'
  | 'run-terminal'
  | 'execute-script'
  | 'inspect-workspace'
  | 'version-control-status'
  | 'version-control-init'
  | 'version-control-commit'
  | 'version-control-branch'
  | 'version-control-diff'
  | 'search-files'
  | 'search-text'
  | 'open-editor'
  | 'edit-code'
  | 'open-workspace'
  | 'close-workspace'
  | 'browse-web'
  | 'preview-project'
  | '3d-model'
  | 'render-scene'
  | 'build-project'
  | 'test-project'
  | 'install-packages'
  | 'remove-packages'
  | (string & {});

/** How closely a resolved capability matches the requested ability. */
export type ResolutionConfidence = 'exact' | 'partial' | 'fallback';

/** Result of resolving a mission ability to a concrete tool capability. */
export interface ResolvedCapability {
  readonly ability: MissionAbility;
  readonly toolId: ToolId;
  readonly capabilityId: string;
  readonly capabilityName: string;
  readonly confidence: ResolutionConfidence;
  readonly requiresSession: boolean;
  readonly inputSchema: Record<string, unknown>;
}

// --- ToolSession types ---------------------------------------------------------

/** A stateful session on a tool, spanning multiple capability invocations. */
export interface ToolSession {
  readonly sessionId: string;
  readonly toolId: ToolId;
  readonly state: Readonly<Record<string, Json>>;
  readonly createdAt: Timestamp;
  readonly lastActivityAt: Timestamp;
  readonly isActive: boolean;
  readonly metadata: Readonly<Record<string, Json>>;
}

/** Options for creating a new tool session. */
export interface ToolSessionOptions {
  readonly toolId: ToolId;
  readonly initialState?: Readonly<Record<string, Json>>;
  readonly metadata?: Readonly<Record<string, Json>>;
}

/** A request to execute a capability (used by ToolOrchestrator). */
export interface CapabilityExecutionRequest {
  readonly capabilityId: string;
  readonly input: Json;
  readonly actor: ToolActor;
  readonly correlationId: UUID | null;
  readonly sessionId?: string;
  readonly signal?: AbortSignal;
}

/** Options for the ToolOrchestrator. */
export interface ToolOrchestratorOptions {
  readonly toolManager: ToolManager;
  readonly eventBus: EventBusContract;
  readonly logger?: Logger;
  readonly defaultSessionTimeoutMs?: number;
}

/** Options for the CapabilityPlanner. */
export interface CapabilityPlannerOptions {
  readonly toolManager: ToolManager;
  readonly logger?: Logger;
  readonly customMappings?: ReadonlyArray<AbilityMapping>;
}

/** Maps a mission ability to a tool capability pattern. */
export interface AbilityMapping {
  readonly ability: MissionAbility;
  readonly capabilityPattern: string;
  readonly preferredToolIds?: ReadonlyArray<string>;
  readonly requiresSession?: boolean;
  readonly category: CapabilityCategory;
}

// --- re-exports of external contracts used across the package -----------------
export type { EventBusContract, Logger, Disposable, Json, Timestamp, UUID };
