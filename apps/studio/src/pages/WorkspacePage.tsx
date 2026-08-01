import { Boxes, LayoutDashboard } from 'lucide-react';
import { Page } from '../components/layout/Page';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import type { Intent } from '../design/variants';
import { useStudioData } from '../studio/StudioDataProvider';

const HEALTH_INTENT: Record<string, Intent> = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'danger',
  unknown: 'neutral',
};

/**
 * Workspace — the studio overview: live workspace counts plus the capabilities
 * the workspace currently has installed (read from the Studio API).
 */
export function WorkspacePage(): React.ReactNode {
  const { api } = useStudioData();
  const workspace = api.getWorkspace();
  const capabilities = api.listCapabilities();

  return (
    <Page title="Workspace">
      <div className="flex flex-col gap-5">
        <Card
          title="Studio Overview"
          actions={<LayoutDashboard className="size-4 text-fg-subtle" />}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label="Projects" value={String(workspace.projectCount)} />
            <Metric label="Missions" value={String(workspace.missionCount)} />
            <Metric label="Capabilities" value={String(capabilities.length)} />
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-fg-subtle">Readiness</span>
              <Badge intent={workspace.ready ? 'success' : 'neutral'} dot>
                {workspace.ready ? 'Ready' : 'Connecting…'}
              </Badge>
            </div>
          </div>
        </Card>

        <Card
          title="Installed Capabilities"
          subtitle="Actions and tools the workspace can use"
          actions={<Boxes className="size-4 text-fg-subtle" />}
        >
          {capabilities.length === 0 ? (
            <EmptyState title="No capabilities installed" />
          ) : (
            <ul className="divide-y divide-border">
              {capabilities.map((c) => (
                <li key={c.id} className="flex items-start gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-fg">{c.name}</span>
                      <Badge intent={c.enabled ? 'success' : 'neutral'} size="sm">
                        {c.enabled ? 'enabled' : 'disabled'}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-fg-muted">{c.description}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center rounded-full border border-border bg-bg-inset px-2 py-0.5 text-[10px] text-fg-muted">
                        {c.category}
                      </span>
                      {c.supportedPlatforms.slice(0, 3).map((p) => (
                        <span
                          key={p}
                          className="inline-flex items-center rounded-full border border-border bg-bg-inset px-2 py-0.5 text-[10px] text-fg-muted"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-fg-muted">
                    <StatusIndicator intent={HEALTH_INTENT[c.health] ?? 'neutral'} />
                    {c.health}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Page>
  );
}

function Metric({
  label,
  value,
}: { readonly label: string; readonly value: string }): React.ReactNode {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-fg-subtle">{label}</span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums text-fg">{value}</span>
    </div>
  );
}
