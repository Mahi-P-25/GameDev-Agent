import { Page } from '../components/layout/Page';
import { Badge } from '../components/ui/primitives';
import { useStudioData } from '../studio/StudioDataProvider';
import { projectStatusIntent, timeAgo } from './statusMaps';

export function ProjectsPage(): React.ReactNode {
  const { api } = useStudioData();
  const projects = api.listProjects();

  return (
    <Page title="Projects">
      <div className="glass-panel p-6">
        <h2 className="text-sm font-semibold text-[#f5f5f5]">Projects</h2>
        <p className="mt-0.5 text-xs text-[#8a8a8a]">
          {projects.length} project{projects.length === 1 ? '' : 's'} in this workspace
        </p>
        {projects.length === 0 ? (
          <p className="mt-4 text-sm text-[#5c5c5c]">No projects yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-[rgba(255,255,255,0.06)]">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[#f5f5f5]">{p.name}</div>
                  <div className="text-xs text-[#5c5c5c]">{p.description}</div>
                </div>
                <div className="shrink-0 text-right">
                  <Badge intent={projectStatusIntent(p.status)} dot>
                    {p.status}
                  </Badge>
                  <div className="mt-1 text-[11px] text-[#5c5c5c]">
                    updated {timeAgo(p.updatedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}
