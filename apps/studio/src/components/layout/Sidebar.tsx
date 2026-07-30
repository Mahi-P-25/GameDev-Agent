import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { NovaMark, NovaWordmark } from '../brand';
import { Icon, type IconName } from '../icons';
import { cn } from '../../design/cn';

export interface NavEntry {
  readonly to: string;
  readonly label: string;
  readonly icon: IconName;
}

const NAV_ITEMS: ReadonlyArray<NavEntry> = [
  { to: '/', label: 'Dashboard', icon: 'home' },
  { to: '/missions', label: 'Missions', icon: 'mission' },
  { to: '/projects', label: 'Projects', icon: 'projects' },
  { to: '/studio', label: 'Agents', icon: 'agents' },
  { to: '/intelligence', label: 'Knowledge', icon: 'memory' },
  { to: '/workflows', label: 'Tools', icon: 'workflow' },
  { to: '/inbox', label: 'Inbox', icon: 'inbox' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

const RECENT_MISSIONS = [
  { name: 'Optimize terrain LODs', time: '2m ago', status: 'active' as const },
  { name: 'Fix shader compilation', time: '1h ago', status: 'complete' as const },
  { name: 'Generate procedural assets', time: '3h ago', status: 'complete' as const },
  { name: 'Refactor physics pipeline', time: '1d ago', status: 'queued' as const },
];

export function Sidebar(): React.ReactNode {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      'nova-sidebar transition-all duration-300 ease-standard',
      collapsed ? 'w-16' : 'w-[--sidebar-width]',
    )}>
      <div className={cn(
        'flex items-center border-b border-border px-4 py-3',
        collapsed ? 'justify-center' : 'justify-between',
      )}>
        {collapsed ? (
          <NovaMark size="sm" />
        ) : (
          <NovaWordmark size="sm" withMark withEyebrow={false} />
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'grid size-6 place-items-center rounded-md text-fg-subtle hover:text-fg hover:bg-bg-hover transition-colors duration-fast',
            collapsed && 'rotate-180',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className="size-3.5" />
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-fast',
              isActive
                ? 'text-accent bg-accent-soft'
                : 'text-fg-muted hover:text-fg hover:bg-bg-hover',
              collapsed && 'justify-center px-2',
            )}
            aria-label={item.label}
          >
            <Icon name={item.icon} size={18} />
            {!collapsed && (
              <span className="text-sm font-medium leading-none">{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {!collapsed && (
        <>
          <div className="mt-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
                Recent Missions
              </span>
              <button type="button" className="text-[10px] text-fg-subtle hover:text-fg transition-colors duration-fast">
                View all
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-0.5">
              {RECENT_MISSIONS.map((mission) => (
                <button
                  key={mission.name}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors duration-fast hover:bg-bg-hover"
                >
                  <span className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    mission.status === 'active' && 'bg-accent',
                    mission.status === 'complete' && 'bg-success',
                    mission.status === 'queued' && 'bg-fg-subtle',
                  )} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-fg">{mission.name}</div>
                    <div className="text-[11px] text-fg-subtle">{mission.time}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mx-4 mb-4 rounded-lg border border-border bg-bg-panel p-3">
            <div className="flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
                <Icon name="spark" size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-fg">Nova Pro</div>
                <div className="mt-0.5 text-[11px] text-fg-muted leading-snug">
                  Unlock unlimited missions and priority support.
                </div>
                <button
                  type="button"
                  className="mt-2 rounded-md bg-accent px-3 py-1 text-[11px] font-semibold text-bg-base transition-opacity duration-fast hover:opacity-90"
                >
                  Upgrade
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
