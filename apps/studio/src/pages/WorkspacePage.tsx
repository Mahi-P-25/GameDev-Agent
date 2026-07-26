import { Page } from '../components/layout/Page';
import { Badge, Card, EmptyState, StatusDot, Tag } from '../components/ui/primitives';
import { useStudioData } from '../studio/StudioDataProvider';

const HEALTH_INTENT = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'danger',
  unknown: 'neutral',
} as const;

/**
 * Workspace — the studio overview: live workspace counts plus the capabilities
 * the workspace currently has installed (read from the Studio API). This is the
 * "everything belongs to a Workspace" surface; deeper workspace settings land
 * with the Workspace API.
 */
export function WorkspacePage(): React.ReactNode {
  const { api } = useStudioData();
  const workspace = api.getWorkspace();
  const capabilities = api.listCapabilities();

  return (
    <Page title="Workspace" status={workspace.ready ? 'ready' : 'offline'}>
      <div className="nova-col--5">
        <Card title="Studio Overview">
          <div className="nova-kv">
            <div className="nova-kv__key">Projects</div>
            <div className="nova-kv__val">{workspace.projectCount}</div>
            <div className="nova-kv__key">Missions</div>
            <div className="nova-kv__val">{workspace.missionCount}</div>
            <div className="nova-kv__key">Capabilities</div>
            <div className="nova-kv__val">{capabilities.length}</div>
            <div className="nova-kv__key">Readiness</div>
            <div className="nova-kv__val">
              <Badge intent={workspace.ready ? 'success' : 'neutral'} dot>
                {workspace.ready ? 'Ready' : 'Connecting…'}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      <div className="nova-col--7">
        <Card title="Installed Capabilities" subtitle="Actions and tools the workspace can use">
          {capabilities.length === 0 ? (
            <EmptyState title="No capabilities installed" />
          ) : (
            <div className="nova-list">
              {capabilities.map((c) => (
                <div key={c.id} className="nova-list__item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="nova-row" style={{ gap: 8 }}>
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      {c.enabled ? (
                        <Badge intent="success">enabled</Badge>
                      ) : (
                        <Badge intent="neutral">disabled</Badge>
                      )}
                    </div>
                    <div className="nova-subtle" style={{ fontSize: 12.5 }}>
                      {c.description}
                    </div>
                    <div className="nova-row" style={{ marginTop: 6, gap: 6, flexWrap: 'wrap' }}>
                      <Tag>{c.category}</Tag>
                      {c.supportedPlatforms.slice(0, 3).map((p) => (
                        <Tag key={p}>{p}</Tag>
                      ))}
                    </div>
                  </div>
                  <span className="nova-row" style={{ gap: 6, fontSize: 12 }}>
                    <StatusDot intent={HEALTH_INTENT[c.health]} />
                    <span className="nova-muted">{c.health}</span>
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
