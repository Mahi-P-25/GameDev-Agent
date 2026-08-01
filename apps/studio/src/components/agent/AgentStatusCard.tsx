import { Cpu, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '../ui/Card';

export function AgentStatusCard(): ReactNode {
  return (
    <Card size="sm" title="Agent" subtitle="Nova Agent · v2.4.1">
      <div className="flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
          <Cpu className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-fg">Capability Planner</div>
          <div className="mt-0.5 text-xs text-fg-subtle">Confidence 87%</div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-bg-inset">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: '87%' }}
            />
          </div>
        </div>
      </div>
      <button
        type="button"
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-bg-inset px-3 py-1.5 text-xs text-fg-muted transition-colors duration-fast hover:border-border-strong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <ExternalLink className="size-3" />
        View full status
      </button>
    </Card>
  );
}
