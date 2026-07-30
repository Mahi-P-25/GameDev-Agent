import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../design/cn';

export function UpgradeBanner(): ReactNode {
  return (
    <div className={cn(
      'flex items-center justify-between gap-4 rounded-xl border border-border bg-bg-panel',
      'px-5 py-3.5',
    )}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-fg">Unlock Nova Pro</div>
          <div className="text-xs text-fg-muted mt-0.5">
            Get unlimited missions, priority processing, and advanced analytics.
          </div>
        </div>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-bg-base hover:bg-accent-strong transition-all duration-fast"
      >
        Upgrade
      </button>
    </div>
  );
}
