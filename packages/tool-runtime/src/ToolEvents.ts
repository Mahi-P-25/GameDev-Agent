import type { EventDefinition } from '@gamedev-agent/events';
import type { ToolConnectionState, ToolHealth, ToolId, ToolPlatform } from './ToolTypes';

/**
 * Strongly-typed event catalog for the Nova Tool Runtime.
 *
 * Following the Nova convention `<aggregate>.<pastTenseVerb>` (e.g.
 * `tool.registered`), every meaningful state change emits a typed
 * {@link EventDefinition} (stable `type` + `version: 1`). Subscribers bind to
 * the definition, not a magic string, so payloads are fully inferred and the
 * compiler catches drift. The runtime publishes these through the shared Event
 * Bus — it never calls other packages directly. This is how the Studio API,
 * Coordinator, Memory, and UI observe tool activity without the runtime
 * depending on them.
 */

export interface ToolRegisteredPayload {
  readonly toolId: ToolId;
  readonly name: string;
  readonly category: string;
  readonly version: string;
  readonly timestamp: number;
}

export interface ToolUnregisteredPayload {
  readonly toolId: ToolId;
  readonly timestamp: number;
}

export interface ToolConnectionChangedPayload {
  readonly toolId: ToolId;
  readonly state: ToolConnectionState;
  readonly previous: ToolConnectionState;
  readonly timestamp: number;
}

export interface ToolHealthChangedPayload {
  readonly toolId: ToolId;
  readonly health: ToolHealth;
  readonly previous: ToolHealth;
  readonly timestamp: number;
}

export interface ToolInvokedPayload {
  readonly toolId: ToolId;
  readonly action: string;
  readonly correlationId: string | null;
  readonly timestamp: number;
}

export interface ToolInvocationSucceededPayload {
  readonly toolId: ToolId;
  readonly action: string;
  readonly correlationId: string | null;
  readonly durationMs: number;
  readonly timestamp: number;
}

export interface ToolInvocationFailedPayload {
  readonly toolId: ToolId;
  readonly action: string;
  readonly correlationId: string | null;
  readonly code: string;
  readonly message: string;
  readonly durationMs: number;
  readonly timestamp: number;
}

export interface ToolPermissionDeniedPayload {
  readonly toolId: ToolId;
  readonly action: string;
  readonly missing: ReadonlyArray<string>;
  readonly correlationId: string | null;
  readonly timestamp: number;
}

export const ToolRegistered = define<ToolRegisteredPayload>('tool.registered');
export const ToolUnregistered = define<ToolUnregisteredPayload>('tool.unregistered');
export const ToolConnectionChanged =
  define<ToolConnectionChangedPayload>('tool.connection-changed');
export const ToolHealthChanged = define<ToolHealthChangedPayload>('tool.health-changed');
export const ToolInvoked = define<ToolInvokedPayload>('tool.invoked');
export const ToolInvocationSucceeded = define<ToolInvocationSucceededPayload>(
  'tool.invocation-succeeded',
);
export const ToolInvocationFailed = define<ToolInvocationFailedPayload>('tool.invocation-failed');
export const ToolPermissionDenied = define<ToolPermissionDeniedPayload>('tool.permission-denied');

/** All Tool Runtime event payloads, for consumers that need a union. */
export type ToolEventPayloads =
  | ToolRegisteredPayload
  | ToolUnregisteredPayload
  | ToolConnectionChangedPayload
  | ToolHealthChangedPayload
  | ToolInvokedPayload
  | ToolInvocationSucceededPayload
  | ToolInvocationFailedPayload
  | ToolPermissionDeniedPayload;

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

// Re-export the platform type so subscribers can type-guard connection payloads.
export type { ToolPlatform };
