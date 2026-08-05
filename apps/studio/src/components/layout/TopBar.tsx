import { Bell, Search, Sparkles } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../design/cn';
import { useCommandCenter } from '../../modules/command-center/CommandCenterModule';

interface TopBarProps {
  readonly title?: string;
}

const TOP_NAV_TABS = [
  { to: '/workspace', label: 'Workspace' },
  { to: '/studio', label: 'Studio' },
  { to: '/studio', label: 'Agents' },
  { to: '/intelligence', label: 'Intelligence' },
  { to: '/settings', label: 'Settings' },
];

export function TopBar({ title }: TopBarProps): React.ReactNode {
  const { toggle } = useCommandCenter();

  return (
    <header className="flex h-12 w-full items-center justify-between border-b border-border/80 bg-bg-panel/95 px-4 backdrop-blur-xl select-none">
      {/* Left: Navigation Tabs */}
      <div className="flex items-center gap-1 min-w-0">
        <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-bg-surface/60 p-1">
          {TOP_NAV_TABS.map((tab) => (
            <NavLink
              key={tab.label}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-1 text-xs font-semibold transition-all duration-fast',
                  isActive
                    ? 'bg-accent/15 text-accent shadow-sm'
                    : 'text-fg-muted hover:text-fg hover:bg-bg-hover',
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>

        {title && (
          <div className="hidden lg:flex items-center gap-2 ml-3">
            <span className="text-fg-subtle text-xs">/</span>
            <span className="text-xs font-semibold text-fg truncate">{title}</span>
          </div>
        )}
      </div>

      {/* Center: Brand Title */}
      <div className="hidden md:flex items-center gap-2 text-sm font-bold text-fg">
        <Sparkles className="size-4 text-accent animate-pulse" />
        <span>Nova Studio</span>
      </div>

      {/* Right: Search, Notifications, Avatar */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-2 rounded-xl border border-border bg-bg-surface px-3 py-1.5 text-xs text-fg-muted transition-colors duration-fast hover:border-accent/40 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          aria-label="Search or run a command"
        >
          <Search className="size-3.5 text-fg-subtle" />
          <span className="hidden sm:inline">Search…</span>
          <kbd className="ml-1 rounded border border-border bg-bg-hover px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle">
            Ctrl K
          </kbd>
        </button>

        <button
          type="button"
          className="relative grid size-8 place-items-center rounded-xl border border-border/60 bg-bg-surface text-fg-muted hover:text-fg hover:bg-bg-hover transition-all duration-fast"
          aria-label="Notifications"
        >
          <Bell className="size-3.5" />
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent" />
        </button>

        <div className="grid size-8 place-items-center rounded-xl border border-accent/40 bg-accent/20 text-xs font-bold text-accent shadow-sm cursor-pointer hover:scale-105 transition-transform">
          MV
        </div>
      </div>
    </header>
  );
}
