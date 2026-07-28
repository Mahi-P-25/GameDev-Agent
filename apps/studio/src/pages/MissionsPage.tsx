import type { StudioMission } from '@gamedev-agent/studio-api';
import { useMemo } from 'react';
import { Page } from '../components/layout/Page';
import { Badge } from '../components/ui/primitives';
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
      <div className="glass-panel p-6">
        <h2 className="text-sm font-semibold text-[#f5f5f5]">Mission Tree</h2>
        <p className="mt-0.5 text-xs text-[#8a8a8a]">
          {missions.length} mission{missions.length === 1 ? '' : 's'} across {byProject.length} project{byProject.length === 1 ? '' : 's'}
        </p>
        {missions.length === 0 ? (
          <p className="mt-4 text-sm text-[#5c5c5c]">No missions yet. Missions submitted through the Coordinator appear here.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {byProject.map(([projectId, list]) => (
              <div key={projectId}>
                <div className="mb-1 flex items-center gap-2 text-xs font-mono text-[#5c5c5c]">
                  <span>{projectId}</span>
                  <span>· {list.length} mission(s)</span>
                </div>
                <div className="divide-y divide-[rgba(255,255,255,0.06)]">
                  {list.map((m) => (
                    <div key={m.id} className="flex items-start gap-4 py-3">
                      <div className="min-w-0 flex-1 pl-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#f5f5f5]">{m.title}</span>
                          {m.approvalPending && <Badge intent="warning">approval</Badge>}
                        </div>
                        <div className="mt-0.5 text-xs text-[#5c5c5c]">
                          {missionStatusLabel(m.status)} · {m.progress}% complete
                        </div>
                        {m.roleRequirements.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {m.roleRequirements.map((r) => (
                              <span key={r.role} className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 text-[10px] text-[#8a8a8a]">{r.role}</span>
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
      </div>
    </Page>
  );
}
