import type { EventDefinition } from '@gamedev-agent/events';
import type { CapabilityHealth } from './CapabilityDescriptor';
import type { CapabilityId } from './CapabilityDescriptor';

/**
 * Strongly-typed event catalog for the Nova Capability Framework.
 *
 * Following the Nova convention `<aggregate>.<pastTenseVerb>`, every lifecycle
 * transition of a capability (register → enable → disable → request → start →
 * complete → fail) emits a typed {@link EventDefinition} — stable `type` plus
 * `version: 1`. The framework publishes these through the shared Event Bus and
 * never calls other packages (Coordinator, Roles, Kernel) directly. This is the
 * single mechanism by which future subsystems observe and react to capability
 * activity without the framework depending on them.
 *
 * Note: the Capability Framework emits events but does **not** subscribe to
 * external control events itself — it is a passive service driven by the
 * {@link CapabilityManager}.
 */

/** A capability was registered with the registry. */
export interface CapabilityRegisteredPayload {
  readonly capabilityId: CapabilityId;
  readonly name: string;
  readonly category: string;
  readonly timestamp: number;
}

/** A capability was enabled (became executable). */
export interface CapabilityEnabledPayload {
  readonly capabilityId: CapabilityId;
  readonly timestamp: number;
}

/** A capability was disabled (no longer executable). */
export interface CapabilityDisabledPayload {
  readonly capabilityId: CapabilityId;
  readonly timestamp: number;
}

/**
 * A caller requested execution of a capability. Emitted before any platform/
 * permission/health gate is applied, so observers can audit intent.
 */
export interface CapabilityRequestedPayload {
  readonly capabilityId: CapabilityId;
  readonly correlationId: string | null;
  readonly timestamp: number;
}

/** Execution passed all gates and started. */
export interface CapabilityStartedPayload {
  readonly capabilityId: CapabilityId;
  readonly correlationId: string | null;
  readonly timestamp: number;
}

/** Execution finished successfully. */
export interface CapabilityCompletedPayload {
  readonly capabilityId: CapabilityId;
  readonly correlationId: string | null;
  readonly durationMs: number;
  readonly timestamp: number;
}

/** Execution failed (gate rejection or runtime failure). */
export interface CapabilityFailedPayload {
  readonly capabilityId: CapabilityId;
  readonly correlationId: string | null;
  readonly code: string;
  readonly message: string;
  readonly durationMs: number;
  readonly timestamp: number;
}

/** A capability's health was (re)assessed. */
export interface CapabilityHealthChangedPayload {
  readonly capabilityId: CapabilityId;
  readonly health: CapabilityHealth;
  readonly previous: CapabilityHealth;
  readonly timestamp: number;
}

export const CapabilityRegistered = define<CapabilityRegisteredPayload>('capability.registered');
export const CapabilityEnabled = define<CapabilityEnabledPayload>('capability.enabled');
export const CapabilityDisabled = define<CapabilityDisabledPayload>('capability.disabled');
export const CapabilityRequested = define<CapabilityRequestedPayload>('capability.requested');
export const CapabilityStarted = define<CapabilityStartedPayload>('capability.started');
export const CapabilityCompleted = define<CapabilityCompletedPayload>('capability.completed');
export const CapabilityFailed = define<CapabilityFailedPayload>('capability.failed');
export const CapabilityHealthChanged = define<CapabilityHealthChangedPayload>(
  'capability.health-changed',
);

/** All capability event payloads, for consumers that need a union. */
export type CapabilityEventPayloads =
  | CapabilityRegisteredPayload
  | CapabilityEnabledPayload
  | CapabilityDisabledPayload
  | CapabilityRequestedPayload
  | CapabilityStartedPayload
  | CapabilityCompletedPayload
  | CapabilityFailedPayload
  | CapabilityHealthChangedPayload;

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}
