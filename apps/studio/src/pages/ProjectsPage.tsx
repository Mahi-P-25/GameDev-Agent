import type { StudioProjectSummary } from '@gamedev-agent/studio-api';
import { FolderOpen } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '../components/layout/Page';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { useStudioData } from '../studio/StudioDataProvider';
import { projectStatusIntent, timeAgo } from './statusMaps';

export function ProjectsPage(): React.ReactNode {
  const { api } = useStudioData();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ReadonlyArray<StudioProjectSummary>>([]);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!api.ready) {
      return;
    }
    setProjects(api.listProjects());
  }, [api]);

  useEffect(() => {
    if (!api.ready) {
      const handle = setTimeout(refresh, 100);
      return () => clearTimeout(handle);
    }
    refresh();
    const disposer = api.onActivity(() => {
      refresh();
    });
    return () => {
      disposer.dispose();
    };
  }, [api.ready, api, refresh]);

  const handleOpenProject = useCallback(
    async (id: string) => {
      setOpeningId(id);
      try {
        await api.openProject(id);
        navigate('/intelligence');
      } catch (error) {
        console.error('Failed to open project:', error);
      } finally {
        setOpeningId(null);
      }
    },
    [api, navigate],
  );

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
                <li
                  key={p.id}
                  className="flex cursor-pointer items-center gap-4 rounded-md p-3 transition-colors duration-fast hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  onClick={() => handleOpenProject(p.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-fg">{p.name}</div>
                    <div className="mt-0.5 text-xs text-fg-muted">{p.description}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge intent={projectStatusIntent(p.status)} dot>
                      {openingId === p.id ? 'opening…' : p.status}
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
