import type { Json } from '@gamedev-agent/shared';

/**
 * Branded capability identifier. A stable, namespaced key (e.g.
 * `nova.capability.vscode`) that uniquely addresses a capability within the
 * registry. Plain string at runtime, distinct at the type level.
 */
export type CapabilityId = string & { readonly __brand: 'CapabilityId' };

/** Coerce a string into a {@link CapabilityId}. Purely a type-level assertion. */
export function asCapabilityId(value: string): CapabilityId {
  return value as CapabilityId;
}

/**
 * Functional grouping of capabilities. Drives permission scoping, UI
 * organization, and future capability discovery (e.g. "all editor
 * capabilities"). Open set via the `string & {}` escape so new categories can be
 * added without a breaking enum change.
 */
export type CapabilityCategory =
  | 'editor'
  | 'vcs'
  | 'filesystem'
  | 'shell'
  | 'browser'
  | '3d'
  | 'graphics'
  | 'build'
  | 'ai'
  | (string & {});

/**
 * The set of platforms a capability can run on. Used to gate enablement and to
 * surface "unsupported on this host" errors before any execution is attempted.
 */
export type Platform = 'win32' | 'darwin' | 'linux' | 'web' | (string & {});

/**
 * Coarse permission a capability needs to operate. Checked against the ambient
 * permission set by the {@link CapabilityManager} before {@link Capability.execute}
 * is allowed. Kept as a flat string set so it composes with policy engines later.
 */
export type CapabilityPermission =
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

/**
 * A tool a capability depends on (an external binary, app, or service). The
 * framework verifies availability at enable time via a {@link ToolProbe}; an
 * unavailable required tool keeps the capability disabled rather than failing at
 * runtime.
 */
export interface RequiredTool {
  /** Stable tool key, e.g. `git`, `code`, `blender`, `three`. */
  readonly name: string;
  /** Optional minimum semver the capability was tested against. */
  readonly minVersion?: string;
  /** Human-readable note shown when the tool is missing. */
  readonly note?: string;
}

/**
 * Runtime health of a capability. Surfaced by `health()`, polled by the
 * Coordinator/Kernel for dashboards, and used to gate execution.
 */
export type CapabilityHealth = 'unknown' | 'healthy' | 'degraded' | 'unhealthy';

/**
 * The static contract a capability publishes about itself. This is the
 * "capability card" — everything a Role needs to decide whether to use it,
 * without the Role knowing anything about the implementation.
 */
export interface CapabilityDescriptor {
  /** Unique, stable identifier. */
  readonly id: CapabilityId;
  /** Human-readable name. */
  readonly name: string;
  /** What the capability does, in one or two sentences. */
  readonly description: string;
  /** Semver of the capability definition/implementation. */
  readonly version: string;
  /** Functional grouping (see {@link CapabilityCategory}). */
  readonly category: CapabilityCategory;
  /** Permissions required to execute the capability. */
  readonly permissions: ReadonlyArray<CapabilityPermission>;
  /** Platforms the capability supports. */
  readonly supportedPlatforms: ReadonlyArray<Platform>;
  /** External tools the capability depends on. */
  readonly requiredTools: ReadonlyArray<RequiredTool>;
  /**
   * JSON-schema-like description of accepted inputs. Kept loose (`Json`) so the
   * framework stays tool-agnostic; concrete capabilities document their own shape.
   */
  readonly inputs: ReadonlyArray<CapabilityParameter>;
  /** Description of the values the capability produces. */
  readonly outputs: ReadonlyArray<CapabilityParameter>;
}

/** A documented input/output parameter of a capability. */
export interface CapabilityParameter {
  /** Parameter name (the key callers pass / receive). */
  readonly name: string;
  /** Human-readable description. */
  readonly description?: string;
  /** Nominal type label, e.g. `string`, `object`, `string[]`. */
  readonly type: string;
  /** Whether the parameter must be supplied/received. */
  readonly required: boolean;
}

/**
 * Live, mutable-per-invocation context handed to a capability when it runs.
 *
 * The context is the seam between the framework (which owns infrastructure:
 * logger, bus, clock, correlation) and the capability (which owns the action).
 * A capability reads `input`, records progress, and writes `output` here; it
 * never reaches back into the framework directly.
 */
export interface CapabilityContext {
  /** The capability instance executing. */
  readonly capability: CapabilityId;
  /** Correlation id linking this execution to a mission/run (from the bus). */
  readonly correlationId: string | null;
  /** The raw input payload the caller supplied. */
  readonly input: Json;
  /** The output payload the capability fills during execution. */
  output: Json;
  /** Optional opaque caller-supplied metadata (tracing, routing). */
  readonly metadata?: Readonly<Record<string, Json>> | undefined;
  /** Report incremental progress (0–100). Safe to call multiple times. */
  reportProgress(progress: number, detail?: string | undefined): void;
  /**
   * Abort signal the framework may trip to cancel a long-running capability.
   * Capabilities poll it periodically.
   */
  readonly signal?: AbortSignal | undefined;
}

/**
 * The result of a capability execution. Success carries an output payload;
 * failure carries a structured error reason. Never throws for expected failures —
 * use this result so the Coordinator can branch on outcome.
 */
export interface CapabilityResult {
  readonly ok: boolean;
  readonly capability: CapabilityId;
  /** Wall-clock duration of the execution, in milliseconds. */
  readonly durationMs: number;
  /** Output payload. Present when `ok` is true; may be `null`. */
  readonly output: Json | null;
  /** Failure reason. Present when `ok` is false. */
  readonly error?: CapabilityErrorInfo | undefined;
  /** Arbitrary structured detail (structured logs, exit codes, paths). */
  readonly detail?: Readonly<Record<string, Json>> | undefined;
}

/** Structured failure info embedded in a {@link CapabilityResult}. */
export interface CapabilityErrorInfo {
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}
