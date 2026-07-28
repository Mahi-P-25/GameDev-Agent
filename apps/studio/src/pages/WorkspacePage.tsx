import { Page } from '../components/layout/Page';
import { Badge, StatusDot } from '../components/ui/primitives';
import { useStudioData } from '../studio/StudioDataProvider';

const HEALTH_INTENT = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'danger',
  unknown: 'neutral',
} as const;

/**
 * Workspace — the studio overview: live workspace counts plus the capabilities
 * the workspace currently has installed (read from the Studio API). This is the
 * "everything belongs to a Workspace" surface; deeper workspace settings land
 * with the Workspace API.
 */
export function WorkspacePage(): React.ReactNode {
  const { api } = useStudioData();
  const workspace = api.getWorkspace();
  const capabilities = api.listCapabilities();

  return (
    <Page title="Workspace">
      <div className="glass-panel grid gap-6 p-6 md:grid-cols-2">
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
          <h2 className="text-sm font-semibold text-[#f5f5f5]">Studio Overview</h2>
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
              <span className="text-[#8a8a8a]">Capabilities</span>
              <span className="text-[#f5f5f5]">{capabilities.length}</span>
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
          <h2 className="text-sm font-semibold text-[#f5f5f5]">Installed Capabilities</h2>
          <p className="mt-0.5 text-xs text-[#8a8a8a]">Actions and tools the workspace can use</p>
          {capabilities.length === 0 ? (
            <p className="mt-4 text-sm text-[#5c5c5c]">No capabilities installed.</p>
          ) : (
            <div className="mt-4 divide-y divide-[rgba(255,255,255,0.06)]">
              {capabilities.map((c) => (
                <div key={c.id} className="flex items-start gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#f5f5f5]">{c.name}</span>
                      {c.enabled ? (
                        <Badge intent="success">enabled</Badge>
                      ) : (
                        <Badge intent="neutral">disabled</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-[#5c5c5c]">{c.description}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 text-[10px] text-[#8a8a8a]">{c.category}</span>
                      {c.supportedPlatforms.slice(0, 3).map((p) => (
                        <span key={p} className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 text-[10px] text-[#8a8a8a]">{p}</span>
                      ))}
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-[#8a8a8a]">
                    <StatusDot intent={HEALTH_INTENT[c.health]} />
                    {c.health}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
