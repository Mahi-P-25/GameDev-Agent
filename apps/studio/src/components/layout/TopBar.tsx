import { Command } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCommandCenter } from '../../modules/command-center/CommandCenterModule';
import { StatusDot } from '../ui/primitives';

export interface TopBarProps {
  readonly title: string;
  readonly status?: 'ready' | 'degraded' | 'offline';
}

const STATUS_LABEL: Record<NonNullable<TopBarProps['status']>, string> = {
  ready: 'All systems ready',
  degraded: 'Degraded',
  offline: 'Connecting…',
};

/**
 * The application top bar: page title, a Command Center trigger (⌘K), and a
 * live studio-status indicator. The trigger opens Nova's global command
 * palette; the same surface is also reachable from anywhere via Ctrl/Cmd+K.
 */
export function TopBar({ title, status = 'ready' }: TopBarProps): ReactNode {
  const intent = status === 'ready' ? 'success' : status === 'degraded' ? 'warning' : 'neutral';
  const { toggle } = useCommandCenter();
  return (
    <header className="nova-topbar">
      <div className="nova-topbar__title">{title}</div>
      <div className="nova-topbar__spacer" />
      <button
        type="button"
        onClick={toggle}
        className="nova-row gap-2 rounded-md border border-border bg-bg-inset px-2.5 py-1.5 text-[12.5px] text-fg-subtle transition-colors duration-fast hover:border-border-strong hover:text-fg"
        aria-label="Open Command Center"
      >
        <Command className="size-3.5" aria-hidden />
        <span>Command</span>
        <kbd className="rounded border border-border bg-bg-elevated px-1.5 py-0.5 text-[10px]">
          ⌘K
        </kbd>
      </button>
      <div className="nova-row" style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
        <StatusDot intent={intent} />
        <span>{STATUS_LABEL[status]}</span>
      </div>
    </header>
  );
}
