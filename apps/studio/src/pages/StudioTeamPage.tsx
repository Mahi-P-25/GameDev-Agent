import { Page } from '../components/layout/Page';
import { StatusDot } from '../components/ui/primitives';
import { useStudioData } from '../studio/StudioDataProvider';
import { roleStatusIntent, roleStatusLabel, timeAgo } from './statusMaps';

/** Studio Team — read-only view of the studio's roles, via placeholder adapter. */
export function StudioTeamPage(): React.ReactNode {
  const { roles } = useStudioData();
  const items = roles.list();

  return (
    <Page title="Studio Team">
      <div className="glass-panel p-6">
        <h2 className="text-sm font-semibold text-[#f5f5f5]">Roles</h2>
        <p className="mt-0.5 text-xs text-[#8a8a8a]">The working roles that compose the studio</p>
        {items.length === 0 ? (
          <p className="mt-4 text-sm text-[#5c5c5c]">No roles defined.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((role) => (
              <div key={role.id} className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-[#f5f5f5]">{role.name}</div>
                  <span className="flex items-center gap-1.5 text-xs text-[#8a8a8a]">
                    <StatusDot intent={roleStatusIntent(role.status)} />
                    {roleStatusLabel(role.status)}
                  </span>
                </div>
                <div className="mt-1.5 text-xs text-[#5c5c5c]">{role.description}</div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 text-[10px] text-[#8a8a8a]">{role.availability}</span>
                  {role.currentMission && (
                    <span className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 text-[10px] text-[#8a8a8a]">{role.currentMission}</span>
                  )}
                </div>
                <div className="mt-2.5 text-[10px] text-[#5c5c5c]">
                  {role.lastActivity ? `Active ${timeAgo(role.lastActivity)}` : 'No recent activity'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}
