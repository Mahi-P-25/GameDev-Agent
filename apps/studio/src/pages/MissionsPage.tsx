import type { StudioMission } from '@gamedev-agent/studio-api';
import { ListTodo } from 'lucide-react';
import { useMemo } from 'react';
import { Page } from '../components/layout/Page';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
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
    <Page title="Missions">
      <div className="flex flex-col gap-5">
        <Card
          title="Mission Tree"
          subtitle={`${missions.length} mission${missions.length === 1 ? '' : 's'} across ${byProject.length} project${byProject.length === 1 ? '' : 's'}`}
          actions={<ListTodo className="size-4 text-fg-subtle" />}
        >
          {missions.length === 0 ? (
            <EmptyState
              title="No missions yet"
              hint="Missions submitted through the Coordinator appear here."
            />
          ) : (
            <div className="space-y-5">
              {byProject.map(([projectId, list]) => (
                <div key={projectId}>
                  <div className="mb-1 flex items-center gap-2 font-mono text-xs text-fg-subtle">
                    <span>{projectId}</span>
                    <span>· {list.length} mission(s)</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {list.map((m) => (
                      <li key={m.id} className="flex items-start gap-4 py-3">
                        <div className="min-w-0 flex-1 pl-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-fg">{m.title}</span>
                            {m.approvalPending && <Badge intent="warning">approval</Badge>}
                          </div>
                          <div className="mt-0.5 text-xs text-fg-muted">
                            {missionStatusLabel(m.status)} · {m.progress}% complete
                          </div>
                          {m.roleRequirements.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {m.roleRequirements.map((r) => (
                                <span
                                  key={r.role}
                                  className="inline-flex items-center rounded-full border border-border bg-bg-inset px-2 py-0.5 text-[10px] text-fg-muted"
                                >
                                  {r.role}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <Badge intent={missionStatusIntent(m.status)}>
                          {missionStatusLabel(m.status)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
