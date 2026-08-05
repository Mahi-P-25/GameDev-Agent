import { motion } from 'motion/react';
import { ChevronDown, ChevronRight, Terminal, Sparkles, FileCode, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../design/cn';
import { ExecutionStep, type StepData } from './ExecutionStep';

export type PhaseKind = 'planning' | 'terminal' | 'files' | 'verification' | 'summary';

export interface ExecutionPhaseData {
  readonly id: string;
  readonly kind: PhaseKind;
  readonly title: string;
  readonly summary?: string;
  readonly status: 'pending' | 'active' | 'done' | 'failed';
  readonly duration?: string;
  readonly steps: ReadonlyArray<StepData>;
}

interface ExecutionPhaseCardProps {
  readonly phase: ExecutionPhaseData;
  readonly defaultExpanded?: boolean;
}

function getPhaseIcon(kind: PhaseKind) {
  switch (kind) {
    case 'planning':
      return Sparkles;
    case 'terminal':
      return Terminal;
    case 'files':
      return FileCode;
    case 'verification':
      return CheckCircle2;
    case 'summary':
    default:
      return Sparkles;
  }
}

export function ExecutionPhaseCard({ phase, defaultExpanded = true }: ExecutionPhaseCardProps): React.ReactNode {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const IconComp = getPhaseIcon(phase.kind);
  const isActive = phase.status === 'active';
  const isDone = phase.status === 'done';
  const isFailed = phase.status === 'failed';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'overflow-hidden rounded-2xl border transition-all duration-fast shadow-sm',
        isActive && 'border-accent/50 bg-bg-panel/95 shadow-[0_0_16px_rgba(214,179,88,0.1)]',
        isDone && 'border-border/80 bg-bg-panel/90',
        isFailed && 'border-danger/40 bg-danger/5',
        phase.status === 'pending' && 'border-border/40 bg-bg-surface/40 opacity-70',
      )}
    >
      {/* Header Bar */}
      <div
        onClick={() => setExpanded((prev) => !prev)}
        className="flex cursor-pointer items-center justify-between border-b border-border/60 bg-bg-surface/80 px-4 py-3 select-none hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {expanded ? (
            <ChevronDown className="size-4 text-accent shrink-0" />
          ) : (
            <ChevronRight className="size-4 text-fg-subtle shrink-0" />
          )}

          <div className="grid size-7 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
            <IconComp className={cn('size-3.5', isActive && 'animate-pulse')} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-fg">{phase.title}</h4>
              <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[10px] text-accent">
                {phase.steps.length} items
              </span>
            </div>
            {phase.summary && (
              <p className="mt-0.5 truncate text-xs text-fg-subtle">{phase.summary}</p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2.5 shrink-0 ml-3">
          {phase.duration && (
            <span className="flex items-center gap-1 font-mono text-[11px] text-fg-subtle hidden sm:inline-flex">
              <Clock className="size-3 text-fg-subtle" />
              {phase.duration}
            </span>
          )}

          {isActive && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-2.5 py-0.5 text-[10px] font-semibold text-accent">
              <span className="size-1.5 rounded-full bg-accent animate-ping" />
              Active
            </span>
          )}

          {isDone && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
              <CheckCircle2 className="size-3" />
              Done
            </span>
          )}

          {isFailed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-semibold text-danger">
              <XCircle className="size-3" />
              Failed
            </span>
          )}
        </div>
      </div>

      {/* Expanded Phase Body */}
      {expanded && (
        <div className="p-4">
          <div className="flex flex-col gap-1">
            {phase.steps.map((step, idx) => (
              <ExecutionStep key={step.id} step={step} index={idx} isLast={idx === phase.steps.length - 1} />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
