import { Page } from '../components/layout/Page';
import { Badge, StatusDot } from '../components/ui/primitives';
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
    <Page title="Settings">
      <div className="glass-panel grid gap-6 p-6 md:grid-cols-2">
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
          <h2 className="text-sm font-semibold text-[#f5f5f5]">Workspace</h2>
          <p className="mt-0.5 text-xs text-[#8a8a8a]">Studio-wide configuration</p>
          <div className="mt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#8a8a8a]">Projects</span>
              <span className="text-[#f5f5f5]">{workspace.projectCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#8a8a8a]">Missions</span>
              <span className="text-[#f5f5f5]">{workspace.missionCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#8a8a8a]">Dependencies</span>
              <div className="flex flex-wrap gap-2">
                {workspace.dependencies.map((d) => (
                  <span key={d.name} className="flex items-center gap-1.5 text-xs text-[#8a8a8a]">
                    <StatusDot
                      intent={
                        d.status === 'up'
                          ? 'success'
                          : d.status === 'degraded'
                            ? 'warning'
                            : 'danger'
                      }
                    />
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#8a8a8a]">Readiness</span>
              <Badge intent={workspace.ready ? 'success' : 'neutral'} dot>
                {workspace.ready ? 'Ready' : 'Connecting…'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
          <h2 className="text-sm font-semibold text-[#f5f5f5]">Appearance</h2>
          <p className="mt-0.5 text-xs text-[#8a8a8a]">Theme preferences</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[#f5f5f5]">Theme</div>
                <div className="text-xs text-[#5c5c5c]">Nova Studio is dark-first.</div>
              </div>
              <Badge intent="neutral">dark</Badge>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-[rgba(255,255,255,0.03)] p-3">
              <span className="h-7 w-7 shrink-0 rounded-md bg-gradient-to-br from-[#d4af37] to-[#5b7cfa]" />
              <span className="text-xs text-[#5c5c5c]">Theme customization placeholder.</span>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
