import { Command } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCommandCenter } from '../../modules/command-center/CommandCenterModule';

export interface TopBarProps {
  readonly title: string;
}

export function TopBar({ title }: TopBarProps): ReactNode {
  const { toggle } = useCommandCenter();
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <h1 className="text-lg font-semibold tracking-tight text-[#f5f5f5]">{title}</h1>
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs text-[#8a8a8a] transition-all duration-200 hover:border-[rgba(255,255,255,0.14)] hover:text-[#f5f5f5]"
        aria-label="Open Command Center"
      >
        <Command className="size-3.5" aria-hidden />
        <span>Command</span>
        <kbd className="rounded border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 text-[10px]">
          ⌘K
        </kbd>
      </button>
    </div>
  );
}
