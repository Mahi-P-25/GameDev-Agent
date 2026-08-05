import { motion } from 'motion/react';
import { CheckCircle2, AlertTriangle, FileCode, Terminal, Clock, Wrench, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '../../design/cn';

export interface MissionSummaryData {
  readonly title?: string;
  readonly executionTime?: string;
  readonly toolsUsed: ReadonlyArray<string>;
  readonly filesModified: ReadonlyArray<string>;
  readonly commandsExecuted: ReadonlyArray<string>;
  readonly resultMessage?: string;
  readonly warnings?: ReadonlyArray<string>;
  readonly nextSuggestedActions?: ReadonlyArray<string>;
}

interface MissionSummaryCardProps {
  readonly summary: MissionSummaryData;
  readonly onActionClick?: ((action: string) => void) | undefined;
  readonly className?: string;
}

export function MissionSummaryCard({ summary, onActionClick, className }: MissionSummaryCardProps): React.ReactNode {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-success/40 bg-bg-panel/95 p-5 shadow-lg backdrop-blur-xl',
        className,
      )}
    >
      {/* Top Banner Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3.5 mb-4">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl border border-success/40 bg-success/15 text-success">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-fg">Mission Complete</h3>
            <p className="text-xs text-fg-subtle">
              {summary.resultMessage || 'All autonomous execution phases and verification contracts passed cleanly.'}
            </p>
          </div>
        </div>

        {summary.executionTime && (
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-surface px-3 py-1 text-xs font-mono text-fg-muted">
            <Clock className="size-3.5 text-accent" />
            <span>{summary.executionTime}</span>
          </div>
        )}
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4 text-xs">
        {/* Tools Used */}
        <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-bg-surface/60 p-3">
          <div className="flex items-center gap-1.5 text-accent font-semibold">
            <Wrench className="size-3.5" />
            <span>Tools Used ({summary.toolsUsed.length})</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {summary.toolsUsed.length > 0 ? (
              summary.toolsUsed.map((t, idx) => (
                <span key={idx} className="rounded bg-bg-hover px-2 py-0.5 font-mono text-[11px] text-fg-muted">
                  {t}
                </span>
              ))
            ) : (
              <span className="text-[11px] text-fg-subtle italic">No tools invoked</span>
            )}
          </div>
        </div>

        {/* Files Modified */}
        <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-bg-surface/60 p-3">
          <div className="flex items-center gap-1.5 text-accent font-semibold">
            <FileCode className="size-3.5" />
            <span>Files Modified ({summary.filesModified.length})</span>
          </div>
          <div className="flex flex-col gap-1 mt-1 font-mono text-[11px]">
            {summary.filesModified.length > 0 ? (
              summary.filesModified.map((f, idx) => (
                <span key={idx} className="truncate text-fg-muted">
                  ✦ {f}
                </span>
              ))
            ) : (
              <span className="text-[11px] text-fg-subtle italic">No files modified</span>
            )}
          </div>
        </div>

        {/* Commands Executed */}
        <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-bg-surface/60 p-3">
          <div className="flex items-center gap-1.5 text-accent font-semibold">
            <Terminal className="size-3.5" />
            <span>Commands ({summary.commandsExecuted.length})</span>
          </div>
          <div className="flex flex-col gap-1 mt-1 font-mono text-[11px]">
            {summary.commandsExecuted.length > 0 ? (
              summary.commandsExecuted.map((c, idx) => (
                <span key={idx} className="truncate text-fg-muted">
                  $ {c}
                </span>
              ))
            ) : (
              <span className="text-[11px] text-fg-subtle italic">No commands executed</span>
            )}
          </div>
        </div>
      </div>

      {/* Warnings Block if any */}
      {summary.warnings && summary.warnings.length > 0 && (
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs">
          <div className="flex items-center gap-2 text-warning font-semibold mb-1">
            <AlertTriangle className="size-4" />
            <span>Warnings Reported ({summary.warnings.length})</span>
          </div>
          <ul className="list-disc pl-5 text-fg-muted text-[11px] space-y-0.5">
            {summary.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Suggested Actions */}
      {summary.nextSuggestedActions && summary.nextSuggestedActions.length > 0 && (
        <div className="border-t border-border/60 pt-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-fg mb-2">
            <Sparkles className="size-3.5 text-accent" />
            <span>Suggested Next Actions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.nextSuggestedActions.map((action, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onActionClick?.(action)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition-transform duration-fast hover:scale-105"
              >
                <span>{action}</span>
                <ArrowRight className="size-3" />
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
