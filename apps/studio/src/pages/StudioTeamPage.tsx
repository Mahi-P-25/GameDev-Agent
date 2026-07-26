import { Page } from '../components/layout/Page';
import { Card, EmptyState, PlaceholderBadge, StatusDot, Tag } from '../components/ui/primitives';
import { useStudioData } from '../studio/StudioDataProvider';
import { roleStatusIntent, roleStatusLabel, timeAgo } from './statusMaps';

/** Studio Team — read-only view of the studio's roles, via placeholder adapter. */
export function StudioTeamPage(): React.ReactNode {
  const { roles } = useStudioData();
  const items = roles.list();

  return (
    <Page title="Studio Team" status="ready">
      <div className="nova-col--12">
        <Card
          title="Roles"
          subtitle="The working roles that compose the studio"
          actions={<PlaceholderBadge />}
        >
          {items.length === 0 ? (
            <EmptyState title="No roles defined" />
          ) : (
            <div className="nova-team-grid">
              {items.map((role) => (
                <div key={role.id} className="nova-team-card">
                  <div className="nova-row" style={{ justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 600 }}>{role.name}</div>
                    <span className="nova-row" style={{ fontSize: 12, gap: 6 }}>
                      <StatusDot intent={roleStatusIntent(role.status)} />
                      <span className="nova-muted">{roleStatusLabel(role.status)}</span>
                    </span>
                  </div>
                  <div className="nova-subtle" style={{ fontSize: 12, marginTop: 6 }}>
                    {role.description}
                  </div>
                  <div className="nova-row" style={{ marginTop: 10, gap: 6, flexWrap: 'wrap' }}>
                    <Tag>{role.availability}</Tag>
                    {role.currentMission !== null && <Tag>{role.currentMission}</Tag>}
                  </div>
                  <div className="nova-subtle" style={{ fontSize: 11.5, marginTop: 10 }}>
                    {role.lastActivity !== null
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
