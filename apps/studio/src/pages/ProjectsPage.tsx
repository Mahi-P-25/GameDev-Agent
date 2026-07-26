import { Page } from '../components/layout/Page';
import { Badge, Card, EmptyState } from '../components/ui/primitives';
import { useStudioData } from '../studio/StudioDataProvider';
import { projectStatusIntent, timeAgo } from './statusMaps';

/** Projects — list of projects sourced from the Studio API. */
export function ProjectsPage(): React.ReactNode {
  const { api } = useStudioData();
  const projects = api.listProjects();

  return (
    <Page title="Projects" status="ready">
      <div className="nova-col--12">
        <Card
          title="Projects"
          subtitle={`${projects.length} project${projects.length === 1 ? '' : 's'} in this workspace`}
        >
          {projects.length === 0 ? (
            <EmptyState
              title="No projects yet"
              hint="Create a project from the Studio API to populate this list."
            />
          ) : (
            <div className="nova-list">
              {projects.map((p) => (
                <div key={p.id} className="nova-list__item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    <div className="nova-subtle" style={{ fontSize: 12.5 }}>
                      {p.description}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Badge intent={projectStatusIntent(p.status)} dot>
                      {p.status}
                    </Badge>
                    <div className="nova-subtle" style={{ fontSize: 11.5, marginTop: 4 }}>
                      updated {timeAgo(p.updatedAt)}
                    </div>
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
