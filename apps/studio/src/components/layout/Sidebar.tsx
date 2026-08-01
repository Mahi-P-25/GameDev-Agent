import { ChevronLeft, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../design/cn';
import { NovaMark, NovaWordmark } from '../brand';
import { Icon, type IconName } from '../icons';
import { SystemStatus } from '../status/SystemStatus';

export interface NavEntry {
  readonly to: string;
  readonly label: string;
  readonly icon: IconName;
}

interface Section {
  readonly label: string;
  readonly items: ReadonlyArray<NavEntry>;
}

const SECTIONS: ReadonlyArray<Section> = [
  {
    label: 'Studio',
    items: [
      { to: '/', label: 'Home', icon: 'home' },
      { to: '/mission-control', label: 'Mission Control', icon: 'mission' },
      { to: '/inbox', label: 'Inbox', icon: 'inbox' },
      { to: '/goals', label: 'Goals', icon: 'goals' },
    ],
  },
  {
    label: 'Pinned Projects',
    items: [{ to: '/projects', label: 'Projects', icon: 'projects' }],
  },
  {
    label: 'Knowledge',
    items: [{ to: '/intelligence', label: 'Project Intelligence', icon: 'memory' }],
  },
  {
    label: 'Agents',
    items: [{ to: '/studio', label: 'Studio Team', icon: 'agents' }],
  },
  {
    label: 'Tools',
    items: [{ to: '/workflows', label: 'Workflows', icon: 'workflow' }],
  },
  {
    label: 'Assets',
    items: [{ to: '/workspace', label: 'Workspace', icon: 'workspace' }],
  },
];

const RECENT_MISSIONS = [
  { name: 'Optimize terrain LODs', time: '2m ago', status: 'active' as const },
  { name: 'Fix shader compilation', time: '1h ago', status: 'complete' as const },
  { name: 'Generate procedural assets', time: '3h ago', status: 'complete' as const },
  { name: 'Refactor physics pipeline', time: '1d ago', status: 'queued' as const },
];

function SectionLabel({
  label,
  collapsed,
}: { readonly label: string; readonly collapsed: boolean }): React.ReactNode {
  if (collapsed) {
    return <div className="mx-auto my-3 h-px w-6 bg-border" aria-hidden="true" />;
  }
  return (
    <span className="mb-1.5 block px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
      {label}
    </span>
  );
}

export function Sidebar(): React.ReactNode {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'nova-sidebar transition-[width] duration-300 ease-standard',
        collapsed ? 'w-16' : 'w-[--sidebar-width]',
      )}
    >
      <div
        className={cn(
          'flex items-center border-b border-border px-4 py-3',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {collapsed ? (
          <NavLink to="/" aria-label="Nova home">
            <NovaMark size="sm" />
          </NavLink>
        ) : (
          <NavLink
            to="/"
            aria-label="Nova home"
            className="transition-opacity duration-fast hover:opacity-80"
          >
            <NovaWordmark size="sm" withMark withEyebrow={false} />
          </NavLink>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'grid size-6 place-items-center rounded-md text-fg-subtle transition-colors duration-fast hover:bg-bg-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
            collapsed && 'rotate-180',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className="size-3.5" />
        </button>
      </div>

      <nav
        className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-4"
        aria-label="Studio navigation"
      >
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <SectionLabel label={section.label} collapsed={collapsed} />
            <div className={cn('flex flex-col', collapsed ? 'gap-1.5' : 'gap-1')}>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-3 rounded-md py-1.5 transition-colors duration-fast',
                      collapsed ? 'justify-center px-0' : 'px-3',
                      isActive ? 'text-accent' : 'text-fg-muted hover:bg-bg-hover hover:text-fg',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        aria-hidden
                        className={cn(
                          'absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-opacity duration-fast',
                          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-30',
                        )}
                      />
                      <Icon name={item.icon} size={18} />
                      {!collapsed && (
                        <span className="text-[13px] font-medium leading-none">{item.label}</span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        <div>
          <SectionLabel label="Recent Missions" collapsed={collapsed} />
          {collapsed ? (
            <NavLink
              to="/missions"
              className="flex justify-center rounded-md py-1.5 text-fg-muted transition-colors duration-fast hover:bg-bg-hover hover:text-fg"
              aria-label="Missions"
            >
              <Icon name="missions" size={18} />
            </NavLink>
          ) : (
            <>
              <div className="flex flex-col gap-0.5">
                {RECENT_MISSIONS.map((mission) => (
                  <button
                    key={mission.name}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-left transition-colors duration-fast hover:bg-bg-hover"
                  >
                    <span
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        mission.status === 'active' && 'bg-accent',
                        mission.status === 'complete' && 'bg-success',
                        mission.status === 'queued' && 'bg-fg-subtle',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] text-fg">{mission.name}</div>
                      <div className="text-[11px] text-fg-subtle">{mission.time}</div>
                    </div>
                  </button>
                ))}
              </div>
              <NavLink
                to="/missions"
                className="mt-1.5 block px-3 text-[11px] text-fg-subtle transition-colors duration-fast hover:text-fg"
              >
                View all missions
              </NavLink>
            </>
          )}
        </div>
      </nav>

      <div className="mt-auto flex flex-col gap-3 border-t border-border px-4 py-3">
        {!collapsed && (
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-md py-1.5 transition-colors duration-fast',
                isActive ? 'text-accent' : 'text-fg-muted hover:bg-bg-hover hover:text-fg',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-opacity duration-fast',
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-30',
                  )}
                />
                <Icon name="settings" size={18} />
                <span className="text-[13px] font-medium leading-none">Settings</span>
              </>
            )}
          </NavLink>
        )}
        {collapsed && (
          <NavLink
            to="/settings"
            aria-label="Settings"
            className="flex justify-center rounded-md py-1.5 text-fg-muted transition-colors duration-fast hover:bg-bg-hover hover:text-fg"
          >
            <Icon name="settings" size={18} />
          </NavLink>
        )}
        <div
          className={cn(
            'flex items-center gap-2',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          <SystemStatus className="min-w-0" compact={collapsed} />
          {!collapsed && (
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-bg-hover px-2 py-1 text-[10px] font-medium text-fg-muted transition-colors duration-fast hover:border-border-strong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <Sparkles className="size-3 text-accent" />
              Upgrade
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
