import { useState } from 'react';
import { Terminal, AlertTriangle, Play, ChevronUp, ChevronDown, Trash2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { cn } from '../../design/cn';

export type TerminalTab = 'terminal' | 'problems' | 'output' | 'build' | 'logs';

interface TerminalPanelProps {
  readonly defaultHeight?: number;
  readonly className?: string;
}

export function TerminalPanel({ className }: TerminalPanelProps): React.ReactNode {
  const [activeTab, setActiveTab] = useState<TerminalTab>('terminal');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [logs, setLogs] = useState<ReadonlyArray<string>>([
    'PS C:\\Users\\hello\\Documents\\GameDev-Agent> pnpm --filter @gamedev-agent/studio dev',
    '> @gamedev-agent/studio@0.1.0 dev C:\\Users\\hello\\Documents\\GameDev-Agent\\apps\\studio',
    '> vite',
    'Port 5173 is in use, trying another one...',
    '  VITE v5.4.21  ready in 1132 ms',
    '  ➜  Local:   http://localhost:5175/',
    '  ➜  Network: http://10.215.232.16:5175/',
    '  ➜  press h + enter to show help',
  ]);

  if (isCollapsed) {
    return (
      <div className="flex h-8 w-full items-center justify-between border-t border-border bg-bg-panel/95 px-4 font-mono text-xs select-none">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="flex items-center gap-1.5 font-bold text-fg hover:text-accent"
          >
            <ChevronUp className="size-3.5 text-accent" />
            <span>Terminal Dock</span>
          </button>
          <span className="text-[10px] text-fg-subtle">VITE v5.4.21 ready on http://localhost:5175/</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-success">
          <CheckCircle2 className="size-3" />
          <span>Build Passing</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col border-t border-border/80 bg-bg-sunken font-mono text-xs select-none shadow-lg', className)}>
      {/* Dock Header Tabs */}
      <div className="flex h-9 items-center justify-between border-b border-border/60 bg-bg-panel px-3">
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'terminal', label: 'Terminal', icon: Terminal },
              { id: 'problems', label: 'Problems (0)', icon: AlertTriangle },
              { id: 'output', label: 'Output', icon: Play },
              { id: 'build', label: 'Build (Passing)', icon: CheckCircle2 },
              { id: 'logs', label: 'Logs', icon: ShieldCheck },
            ] as const
          ).map((t) => {
            const IconComp = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs transition-colors',
                  isActive ? 'bg-bg-surface font-semibold text-accent shadow-sm' : 'text-fg-subtle hover:text-fg hover:bg-bg-hover',
                )}
              >
                <IconComp className={cn('size-3.5', isActive ? 'text-accent' : 'text-fg-subtle')} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLogs([])}
            className="rounded p-1 text-fg-subtle hover:bg-bg-hover hover:text-fg"
            title="Clear Terminal Output"
          >
            <Trash2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            className="rounded p-1 text-fg-subtle hover:bg-bg-hover hover:text-fg"
            title="Collapse Terminal Panel"
          >
            <ChevronDown className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Console Canvas Area */}
      <div className="h-44 overflow-y-auto p-3 text-[11px] leading-relaxed text-fg space-y-1">
        {activeTab === 'terminal' && (
          <div className="space-y-0.5">
            {logs.map((line, idx) => (
              <div
                key={idx}
                className={cn(
                  line.includes('ready in')
                    ? 'text-success font-bold'
                    : line.includes('Local:') || line.includes('Network:')
                      ? 'text-accent font-semibold'
                      : 'text-fg-muted',
                )}
              >
                {line}
              </div>
            ))}
            <div className="flex items-center gap-2 mt-2 font-bold text-accent">
              <span>PS C:\Users\hello\Documents\GameDev-Agent&gt;</span>
              <span className="inline-block h-3.5 w-1.5 animate-pulse bg-accent" />
            </div>
          </div>
        )}

        {activeTab === 'problems' && (
          <div className="py-4 text-center text-fg-subtle italic">No TypeScript or linter errors detected across project files.</div>
        )}

        {activeTab === 'output' && (
          <div className="space-y-0.5 text-fg-muted">
            <div className="text-accent font-bold">[Nova Engine Compiler]</div>
            <div>Loaded 14 modules, 0 syntax warnings, 0 dead code paths.</div>
          </div>
        )}

        {activeTab === 'build' && (
          <div className="space-y-0.5">
            <div className="text-success font-bold">✓ Production Build Succeeded</div>
            <div className="text-fg-subtle">tsc --noEmit &amp;&amp; vite build (0 errors)</div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-0.5 text-fg-muted">
            <div>[00:00:01] EventBus initialized</div>
            <div>[00:00:02] StudioApi connected to local workspace</div>
          </div>
        )}
      </div>
    </div>
  );
}
