import type { Notification, PlaceholderAdapter } from './types';

/**
 * Placeholder Notifications adapter.
 *
 * There is no Notifications subsystem in Sprint 10. This adapter returns typed,
 * clearly-labelled preview notifications so the Inbox page is fully rendered.
 * Replace `list()` with a live Notifications client when it lands — the
 * {@link Notification} type and UI components stay unchanged.
 */
const SAMPLE_NOTIFICATIONS: ReadonlyArray<Notification> = [
  {
    id: 'ntf-approval-1',
    title: 'Mission approval requested',
    body: '"Implement dash mechanic" is waiting for your review.',
    kind: 'approval',
    timestamp: Date.now() - 1000 * 60 * 4,
    read: false,
  },
  {
    id: 'ntf-cap-1',
    title: 'Capability degraded',
    body: 'Git capability reported degraded health after the last restart.',
    kind: 'warning',
    timestamp: Date.now() - 1000 * 60 * 42,
    read: false,
  },
  {
    id: 'ntf-proj-1',
    title: 'Project created',
    body: '"Nebula Drift" was added to the workspace.',
    kind: 'success',
    timestamp: Date.now() - 1000 * 60 * 60 * 3,
    read: true,
  },
  {
    id: 'ntf-info-1',
    title: 'Studio sync complete',
    body: 'Workspace snapshot synced across connected tools.',
    kind: 'info',
    timestamp: Date.now() - 1000 * 60 * 60 * 26,
    read: true,
  },
];

export class PlaceholderNotificationsAdapter implements PlaceholderAdapter<Notification> {
  readonly source = 'placeholder' as const;
  list(): ReadonlyArray<Notification> {
    return SAMPLE_NOTIFICATIONS;
  }
}
