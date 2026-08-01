import { AlertTriangle, Bell, CheckCircle2, Info, MailCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Notification } from '../adapters/types';
import { Page } from '../components/layout/Page';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { useStudioData } from '../studio/StudioDataProvider';
import { missionStatusLabel, timeAgo } from './statusMaps';

const NOTIFICATION_STYLE: Record<Notification['kind'], string> = {
  info: 'text-info bg-info-soft',
  success: 'text-success bg-success-soft',
  warning: 'text-warning bg-warning-soft',
  approval: 'text-warning bg-warning-soft',
};

function notificationIcon(kind: Notification['kind']): ReactNode {
  switch (kind) {
    case 'approval':
      return <MailCheck className="size-3.5" />;
    case 'warning':
      return <AlertTriangle className="size-3.5" />;
    case 'success':
      return <CheckCircle2 className="size-3.5" />;
    default:
      return <Info className="size-3.5" />;
  }
}

/** Inbox — pending approvals (live) plus notifications (placeholder adapter). */
export function InboxPage(): React.ReactNode {
  const { api, notifications } = useStudioData();
  const pendingApprovals = api.listMissions().filter((m) => m.approvalPending);
  const items = notifications.list();

  return (
    <Page title="Inbox">
      <div className="grid gap-5 lg:grid-cols-2">
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
            <EmptyState title="Nothing waiting" hint="No missions are waiting for approval." />
          ) : (
            <ul className="divide-y divide-border">
              {pendingApprovals.map((m) => (
                <li key={m.id} className="flex items-center gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-fg">{m.title}</div>
                    <div className="text-xs text-fg-muted">
                      {missionStatusLabel(m.status)} · {m.id}
                    </div>
                  </div>
                  <Badge intent="warning" size="sm">
                    review
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Notifications"
          subtitle="Studio alerts and digests"
          actions={<Bell className="size-4 text-fg-subtle" />}
        >
          {items.length === 0 ? (
            <EmptyState title="All quiet" hint="No notifications." />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id} className="flex items-start gap-3 py-3">
                  <span
                    className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md ${NOTIFICATION_STYLE[n.kind]}`}
                  >
                    {notificationIcon(n.kind)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-fg">{n.title}</span>
                      {!n.read && (
                        <Badge intent="accent" size="sm">
                          new
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-fg-muted">{n.body}</div>
                  </div>
                  <span className="shrink-0 text-[11px] text-fg-subtle">
                    {timeAgo(n.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Page>
  );
}
