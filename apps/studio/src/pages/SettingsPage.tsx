import { Page } from '../components/layout/Page';
import { Badge, Card, PlaceholderBadge, StatusDot } from '../components/ui/primitives';
import { useStudioData } from '../studio/StudioDataProvider';

/**
 * Settings — workspace configuration and theme.
 *
 * Workspace-level settings (name, capabilities, tools, preferences) are owned by
 * the Workspace aggregate but are not yet exposed through the Studio API, so
 * this page shows the live workspace overview and a clearly-marked theme
 * placeholder. When the Workspace API lands, the form here binds to it.
 */
export function SettingsPage(): React.ReactNode {
  const { api } = useStudioData();
  const workspace = api.getWorkspace();

  return (
    <Page title="Settings" status="ready">
      <div className="nova-col--6">
        <Card title="Workspace" subtitle="Studio-wide configuration">
          <div className="nova-kv">
            <div className="nova-kv__key">Projects</div>
            <div className="nova-kv__val">{workspace.projectCount}</div>
            <div className="nova-kv__key">Missions</div>
            <div className="nova-kv__val">{workspace.missionCount}</div>
            <div className="nova-kv__key">Dependencies</div>
            <div className="nova-kv__val">
              <div className="nova-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {workspace.dependencies.map((d) => (
                  <span key={d.name} className="nova-row" style={{ fontSize: 12.5, gap: 6 }}>
                    <StatusDot
                      intent={
                        d.status === 'up'
                          ? 'success'
                          : d.status === 'degraded'
                            ? 'warning'
                            : 'danger'
                      }
                    />
                    <span className="nova-muted">{d.name}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="nova-kv__key">Readiness</div>
            <div className="nova-kv__val">
              <Badge intent={workspace.ready ? 'success' : 'neutral'} dot>
                {workspace.ready ? 'Ready' : 'Connecting…'}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      <div className="nova-col--6">
        <Card title="Appearance" subtitle="Theme preferences" actions={<PlaceholderBadge />}>
          <div className="nova-stack">
            <div className="nova-row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 500 }}>Theme</div>
                <div className="nova-subtle" style={{ fontSize: 12.5 }}>
                  Nova Studio is dark-first. A theme picker arrives with the Workspace settings API.
                </div>
              </div>
              <Badge intent="neutral">dark</Badge>
            </div>
            <div
              className="nova-row"
              style={{
                gap: 8,
                padding: 'var(--space-3)',
                background: 'var(--color-bg-hover)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
                }}
              />
              <span className="nova-subtle" style={{ fontSize: 12 }}>
                Theme customization is a placeholder in Sprint 10.
              </span>
            </div>
          </div>
        </Card>
      </div>
    </Page>
  );
}
