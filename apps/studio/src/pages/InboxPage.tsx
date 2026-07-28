import type { Notification } from '../adapters/types';
import { Page } from '../components/layout/Page';
import {
  Badge,
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
    <Page title="Inbox">
      <div className="glass-panel grid gap-6 p-6 md:grid-cols-2">
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#f5f5f5]">Pending Approvals</h2>
              <p className="mt-0.5 text-xs text-[#8a8a8a]">Missions awaiting your sign-off</p>
            </div>
            {pendingApprovals.length > 0 && (
              <Badge intent="warning" dot>
                {pendingApprovals.length}
              </Badge>
            )}
          </div>
          {pendingApprovals.length === 0 ? (
            <p className="mt-4 text-sm text-[#5c5c5c]">No missions are waiting for approval.</p>
          ) : (
            <div className="mt-4 divide-y divide-[rgba(255,255,255,0.06)]">
              {pendingApprovals.map((m) => (
                <div key={m.id} className="flex items-center gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[#f5f5f5]">{m.title}</div>
                    <div className="text-xs text-[#5c5c5c]">{missionStatusLabel(m.status)} · {m.id}</div>
                  </div>
                  <Badge intent="warning">review</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
          <h2 className="text-sm font-semibold text-[#f5f5f5]">Notifications</h2>
          <p className="mt-0.5 text-xs text-[#8a8a8a]">Studio alerts and digests</p>
          {items.length === 0 ? (
            <p className="mt-4 text-sm text-[#5c5c5c]">No notifications.</p>
          ) : (
            <div className="mt-4 divide-y divide-[rgba(255,255,255,0.06)]">
              {items.map((n) => (
                <div key={n.id} className="flex items-start gap-3 py-3">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                    style={{
                      color: intentColor(NOTIFICATION_INTENT[n.kind]),
                      background: `color-mix(in srgb, ${intentColor(NOTIFICATION_INTENT[n.kind])} 16%, transparent)`,
                    }}
                  >
                    {notificationIcon(n.kind)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#f5f5f5]">{n.title}</span>
                      {!n.read && <Badge intent="primary">new</Badge>}
                    </div>
                    <div className="text-xs text-[#5c5c5c]">{n.body}</div>
                  </div>
                  <span className="shrink-0 text-[11px] text-[#5c5c5c]">{timeAgo(n.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
