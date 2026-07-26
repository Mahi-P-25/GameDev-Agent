import type { Notification } from '../adapters/types';
import { Page } from '../components/layout/Page';
import {
  Badge,
  Card,
  EmptyState,
  PlaceholderBadge,
  intentColor,
} from '../components/ui/primitives';
import { useStudioData } from '../studio/StudioDataProvider';
import { missionStatusLabel, timeAgo } from './statusMaps';

const NOTIFICATION_INTENT = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  approval: 'warning',
} as const;

function notificationIcon(kind: Notification['kind']): string {
  return kind === 'approval' ? '⚑' : kind === 'warning' ? '!' : kind === 'success' ? '✓' : 'i';
}

/** Inbox — pending approvals (live) plus notifications (placeholder adapter). */
export function InboxPage(): React.ReactNode {
  const { api, notifications } = useStudioData();
  const pendingApprovals = api.listMissions().filter((m) => m.approvalPending);
  const items = notifications.list();

  return (
    <Page title="Inbox" status="ready">
      <div className="nova-col--6">
        <Card
          title="Pending Approvals"
          subtitle="Missions awaiting your sign-off"
          actions={
            pendingApprovals.length > 0 ? (
              <Badge intent="warning" dot>
                {pendingApprovals.length}
              </Badge>
            ) : undefined
          }
        >
          {pendingApprovals.length === 0 ? (
            <EmptyState title="Inbox zero" hint="No missions are waiting for approval." />
          ) : (
            <div className="nova-list">
              {pendingApprovals.map((m) => (
                <div key={m.id} className="nova-list__item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{m.title}</div>
                    <div className="nova-subtle" style={{ fontSize: 12 }}>
                      {missionStatusLabel(m.status)} · {m.id}
                    </div>
                  </div>
                  <Badge intent="warning">review</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="nova-col--6">
        <Card
          title="Notifications"
          subtitle="Studio alerts and digests"
          actions={<PlaceholderBadge />}
        >
          {items.length === 0 ? (
            <EmptyState title="No notifications" />
          ) : (
            <div className="nova-list">
              {items.map((n) => (
                <div key={n.id} className="nova-list__item">
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      color: intentColor(NOTIFICATION_INTENT[n.kind]),
                      background: `color-mix(in srgb, ${intentColor(NOTIFICATION_INTENT[n.kind])} 16%, transparent)`,
                      flexShrink: 0,
                    }}
                  >
                    {notificationIcon(n.kind)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="nova-row" style={{ gap: 8 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{n.title}</div>
                      {!n.read && <Badge intent="primary">new</Badge>}
                    </div>
                    <div className="nova-subtle" style={{ fontSize: 12.5 }}>
                      {n.body}
                    </div>
                  </div>
                  <span className="nova-subtle" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>
                    {timeAgo(n.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
