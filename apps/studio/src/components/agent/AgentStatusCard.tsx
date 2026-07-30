import { Cpu, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';

export function AgentStatusCard(): ReactNode {
  return (
    <div className="rounded-xl border border-border bg-bg-panel overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
          Agent Status
        </h3>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent">
            <Cpu className="size-5" />
          </div>
          <div>
            <div className="text-sm font-medium text-fg">Nova Agent</div>
            <div className="text-[11px] text-fg-subtle">v2.4.1 · Capability Planner</div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-fg-muted">Confidence</span>
            <span className="text-fg font-medium">87%</span>
          </div>
          <div className="h-1.5 rounded-full bg-bg-inset overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: '87%' }}
            />
          </div>
        </div>
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-inset px-3 py-2 text-xs text-fg-muted hover:text-fg hover:bg-bg-hover transition-all duration-fast"
        >
          <ExternalLink className="size-3" />
          View Full Status
        </button>
      </div>
    </div>
  );
}
