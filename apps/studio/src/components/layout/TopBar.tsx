import { Bell, Search, User } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCommandCenter } from '../../modules/command-center/CommandCenterModule';
import { cn } from '../../design/cn';

interface TopBarProps {
  readonly title?: string;
}

export function TopBar({ title }: TopBarProps): ReactNode {
  const { toggle } = useCommandCenter();

  return (
    <header className="nova-topbar">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-2.5 py-1">
          <span className="size-1.5 rounded-full bg-success" />
          <span className="text-[11px] font-medium text-fg-muted">Online</span>
        </span>
        {title && (
          <>
            <span className="text-fg-subtle text-sm">/</span>
            <h1 className="text-sm font-semibold text-fg truncate">{title}</h1>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-2 rounded-lg border border-border bg-bg-inset px-3 py-1.5 text-xs text-fg-muted transition-all duration-fast hover:border-border-strong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          aria-label="Search or run a command"
        >
          <Search className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">Search anything...</span>
          <kbd className="ml-1 rounded border border-border bg-bg-hover px-1.5 py-0.5 text-[10px] text-fg-subtle">
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          className="relative grid size-8 place-items-center rounded-lg text-fg-muted hover:text-fg hover:bg-bg-hover transition-all duration-fast"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent" />
        </button>

        <button
          type="button"
          className={cn(
            'grid size-8 place-items-center rounded-lg',
            'text-fg-muted hover:text-fg hover:bg-bg-hover transition-all duration-fast',
          )}
          aria-label="User menu"
        >
          <User className="size-4" />
        </button>
      </div>
    </header>
  );
}
