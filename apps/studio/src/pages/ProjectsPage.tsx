import { FolderOpen } from 'lucide-react';
import { Page } from '../components/layout/Page';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { useStudioData } from '../studio/StudioDataProvider';
import { projectStatusIntent, timeAgo } from './statusMaps';

export function ProjectsPage(): React.ReactNode {
  const { api } = useStudioData();
  const projects = api.listProjects();

  return (
    <Page title="Projects">
      <div className="flex flex-col gap-5">
        <Card
          title="Projects"
          subtitle={`${projects.length} project${projects.length === 1 ? '' : 's'} in this workspace`}
          actions={<FolderOpen className="size-4 text-fg-subtle" />}
        >
          {projects.length === 0 ? (
            <EmptyState title="No projects yet" hint="Create a project to begin working." />
          ) : (
            <ul className="divide-y divide-border">
              {projects.map((p) => (
                <li key={p.id} className="flex items-center gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-fg">{p.name}</div>
                    <div className="mt-0.5 text-xs text-fg-muted">{p.description}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge intent={projectStatusIntent(p.status)} dot>
                      {p.status}
                    </Badge>
                    <div className="mt-1 text-[11px] text-fg-subtle">
                      updated {timeAgo(p.updatedAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Page>
  );
}
