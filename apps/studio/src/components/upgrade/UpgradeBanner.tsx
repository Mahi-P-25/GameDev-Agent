import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../design/cn';

/**
 * UpgradeBanner — a quiet, dismissible-feeling upgrade affordance. Present but
 * low in the hierarchy; never a loud marketing block.
 */
export function UpgradeBanner(): ReactNode {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-lg border border-border bg-bg-elevated',
        'px-5 py-3',
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="grid size-7 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
          <Sparkles className="size-3.5" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-fg">Nova Pro</div>
          <div className="truncate text-xs text-fg-subtle">
            Unlimited missions, priority processing, advanced analytics.
          </div>
        </div>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-md bg-accent px-3.5 py-1.5 text-xs font-semibold text-fg-on-accent transition-colors duration-fast hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        Upgrade
      </button>
    </div>
  );
}
