import { Users } from 'lucide-react';
import { Page } from '../components/layout/Page';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusChip } from '../components/ui/StatusChip';
import { useStudioData } from '../studio/StudioDataProvider';
import { roleStatusIntent, roleStatusLabel, timeAgo } from './statusMaps';

/** Studio Team — read-only view of the studio's roles, via placeholder adapter. */
export function StudioTeamPage(): React.ReactNode {
  const { roles } = useStudioData();
  const items = roles.list();

  return (
    <Page title="Studio Team">
      <div className="flex flex-col gap-5">
        <Card
          title="Roles"
          subtitle="The working roles that compose the studio"
          actions={<Users className="size-4 text-fg-subtle" />}
        >
          {items.length === 0 ? (
            <EmptyState
              icon={<Users className="size-6" />}
              title="No roles defined"
              hint="Nova's coordinator assembles a team of roles when you submit a mission, each with the capabilities it needs to execute."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((role) => (
                <div key={role.id} className="rounded-lg border border-border bg-bg-inset p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-fg">{role.name}</div>
                    <StatusChip
                      intent={roleStatusIntent(role.status)}
                      label={roleStatusLabel(role.status)}
                    />
                  </div>
                  <div className="mt-1.5 text-xs text-fg-muted">{role.description}</div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center rounded-full border border-border bg-bg-hover px-2 py-0.5 text-[10px] text-fg-muted">
                      {role.availability}
                    </span>
                    {role.currentMission && (
                      <span className="inline-flex items-center rounded-full border border-border bg-bg-hover px-2 py-0.5 text-[10px] text-fg-muted">
                        {role.currentMission}
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 text-[10px] text-fg-subtle">
                    {role.lastActivity
                      ? `Active ${timeAgo(role.lastActivity)}`
                      : 'No recent activity'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
