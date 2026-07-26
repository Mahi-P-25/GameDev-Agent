import type { StudioMission } from '@gamedev-agent/studio-api';
import { useMemo } from 'react';
import { Page } from '../components/layout/Page';
import { Badge, Card, EmptyState, Tag } from '../components/ui/primitives';
import { useStudioData } from '../studio/StudioDataProvider';
import { missionStatusIntent, missionStatusLabel } from './statusMaps';

/**
 * Missions — a read-only mission tree grouped by project. Each mission shows its
 * status, progress, approval state, and the roles the Coordinator determined it
 * needs. Data is read from the Studio API.
 */
export function MissionsPage(): React.ReactNode {
  const { api } = useStudioData();
  const missions = api.listMissions();

  const byProject = useMemo(() => {
    const groups = new Map<string, StudioMission[]>();
    for (const m of missions) {
      const list = groups.get(m.projectId) ?? [];
      list.push(m);
      groups.set(m.projectId, list);
    }
    return [...groups.entries()];
  }, [missions]);

  return (
    <Page title="Missions" status="ready">
      <div className="nova-col--12">
        <Card
          title="Mission Tree"
          subtitle={`${missions.length} mission${missions.length === 1 ? '' : 's'} across ${byProject.length} project${byProject.length === 1 ? '' : 's'}`}
        >
          {missions.length === 0 ? (
            <EmptyState
              title="No missions yet"
              hint="Missions submitted through the Coordinator appear here, grouped by project."
            />
          ) : (
            <div className="nova-stack">
              {byProject.map(([projectId, list]) => (
                <div key={projectId}>
                  <div
                    className="nova-row"
                    style={{ fontSize: 12, color: 'var(--color-text-subtle)', marginBottom: 4 }}
                  >
                    <span className="nova-mono">{projectId}</span>
                    <span>· {list.length} mission(s)</span>
                  </div>
                  <div className="nova-list">
                    {list.map((m) => (
                      <div key={m.id} className="nova-list__item">
                        <div style={{ flex: 1, minWidth: 0, paddingLeft: 8 }}>
                          <div className="nova-row" style={{ gap: 8 }}>
                            <div style={{ fontWeight: 500 }}>{m.title}</div>
                            {m.approvalPending && <Badge intent="warning">approval</Badge>}
                          </div>
                          <div className="nova-subtle" style={{ fontSize: 12 }}>
                            {missionStatusLabel(m.status)} · {m.progress}% complete
                          </div>
                          {m.roleRequirements.length > 0 && (
                            <div
                              className="nova-row"
                              style={{ marginTop: 6, gap: 6, flexWrap: 'wrap' }}
                            >
                              {m.roleRequirements.map((r) => (
                                <Tag key={r.role}>{r.role}</Tag>
                              ))}
                            </div>
                          )}
                        </div>
                        <Badge intent={missionStatusIntent(m.status)}>
                          {missionStatusLabel(m.status)}
                        </Badge>
                      </div>
                    ))}
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
