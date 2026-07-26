import type { EventDefinition } from '../types';

/**
 * Notification Center events.
 *
 * The Notification Center is fed by the shared Event Bus. Any subsystem that
 * wants to surface a notification publishes one of these rather than mutating
 * UI state directly — so the Center stays a pure consumer of the pipeline.
 */
export type NotificationKind = 'info' | 'success' | 'warning' | 'error' | 'approval';

export interface NotificationPayload {
  /** Stable, human-readable title. */
  readonly title: string;
  /** Body / detail line. */
  readonly body: string;
  /** Semantic kind driving how the Center renders it. */
  readonly kind: NotificationKind;
  /** Optional correlation to the workflow execution that produced it. */
  readonly executionId?: string;
  /** Present when the notification is an approval gate awaiting a decision. */
  readonly approval?: {
    readonly executionId: string;
    readonly stepId: string;
  };
}

export const NotificationRaised = define<NotificationPayload>('notification.raised');

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}
