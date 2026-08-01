import { Palette, Settings2 } from 'lucide-react';
import { Page } from '../components/layout/Page';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import type { Intent } from '../design/variants';
import { useStudioData } from '../studio/StudioDataProvider';

const DEP_INTENT: Record<string, Intent> = {
  up: 'success',
  degraded: 'warning',
  down: 'danger',
};

/**
 * Settings — workspace configuration and theme.
 */
export function SettingsPage(): React.ReactNode {
  const { api } = useStudioData();
  const workspace = api.getWorkspace();

  return (
    <Page title="Settings">
      <div className="flex flex-col gap-5">
        <Card
          title="Workspace"
          subtitle="Studio-wide configuration"
          actions={<Settings2 className="size-4 text-fg-subtle" />}
        >
          <div className="space-y-3">
            <Row
              label="Projects"
              value={<span className="text-sm text-fg">{workspace.projectCount}</span>}
            />
            <Row
              label="Missions"
              value={<span className="text-sm text-fg">{workspace.missionCount}</span>}
            />
            <Row
              label="Dependencies"
              value={
                <div className="flex flex-wrap gap-3">
                  {workspace.dependencies.map((d) => (
                    <span key={d.name} className="flex items-center gap-1.5 text-xs text-fg-muted">
                      <StatusIndicator intent={DEP_INTENT[d.status] ?? 'neutral'} />
                      {d.name}
                    </span>
                  ))}
                </div>
              }
            />
            <Row
              label="Readiness"
              value={
                <Badge intent={workspace.ready ? 'success' : 'neutral'} dot>
                  {workspace.ready ? 'Ready' : 'Connecting…'}
                </Badge>
              }
            />
          </div>
        </Card>

        <Card
          title="Appearance"
          subtitle="Theme preferences"
          actions={<Palette className="size-4 text-fg-subtle" />}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-fg">Theme</div>
                <div className="text-xs text-fg-subtle">Nova Studio is dark-first.</div>
              </div>
              <Badge intent="neutral">dark</Badge>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-inset p-3">
              <span className="size-7 shrink-0 rounded-md bg-accent" />
              <span className="text-xs text-fg-subtle">Theme customization placeholder.</span>
            </div>
          </div>
        </Card>
      </div>
    </Page>
  );
}

function Row({
  label,
  value,
}: { readonly label: string; readonly value: React.ReactNode }): React.ReactNode {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-fg-muted">{label}</span>
      {value}
    </div>
  );
}
