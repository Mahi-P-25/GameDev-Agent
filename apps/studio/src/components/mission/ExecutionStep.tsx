import { motion } from 'motion/react';
import { Check, Loader2, X, AlertTriangle, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../design/cn';
import { ExecutionLogViewer } from './ExecutionLogViewer';

export interface StepData {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly status: 'pending' | 'active' | 'done' | 'failed' | 'warning';
  readonly duration?: string;
  readonly logs?: ReadonlyArray<string>;
}

interface ExecutionStepProps {
  readonly step: StepData;
  readonly index?: number;
  readonly isLast?: boolean;
}

export function ExecutionStep({ step, isLast = false }: ExecutionStepProps): React.ReactNode {
  const [showLogs, setShowLogs] = useState(false);

  const isActive = step.status === 'active';
  const isDone = step.status === 'done';
  const isFailed = step.status === 'failed';
  const isWarning = step.status === 'warning';

  const hasLogs = step.logs && step.logs.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="relative flex flex-col gap-2"
    >
      <div className="flex items-start gap-3.5">
        {/* Step Status Icon Indicator */}
        <div className="relative z-10 flex flex-col items-center">
          {isDone ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 350, damping: 22 }}
              className="flex size-6 items-center justify-center rounded-full border border-success/40 bg-success/15 shadow-[0_0_8px_rgba(126,166,136,0.3)]"
            >
              <Check className="size-3.5 text-success" />
            </motion.div>
          ) : isFailed ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 350, damping: 22 }}
              className="flex size-6 items-center justify-center rounded-full border border-danger/40 bg-danger/15 shadow-[0_0_8px_rgba(190,106,99,0.3)]"
            >
              <X className="size-3.5 text-danger" />
            </motion.div>
          ) : isWarning ? (
            <div className="flex size-6 items-center justify-center rounded-full border border-warning/40 bg-warning/15">
              <AlertTriangle className="size-3.5 text-warning" />
            </div>
          ) : isActive ? (
            <div className="relative flex size-6 items-center justify-center">
              <motion.div
                className="absolute inset-0 rounded-full bg-accent opacity-20"
                animate={{ scale: [1, 1.6, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="relative flex size-6 items-center justify-center rounded-full border border-accent/60 bg-accent/20 shadow-[0_0_12px_rgba(214,179,88,0.4)]">
                <Loader2 className="size-3.5 text-accent animate-spin" />
              </div>
            </div>
          ) : (
            <div className="size-6 rounded-full border border-border/80 bg-bg-surface" />
          )}

          {!isLast && (
            <div
              className={cn(
                'my-1 w-px flex-1 min-h-6 transition-colors duration-300',
                isDone ? 'bg-success/40' : isActive ? 'bg-accent/40' : 'bg-border/60',
              )}
            />
          )}
        </div>

        {/* Step Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-1 pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-sm font-semibold transition-colors duration-200',
                  isActive ? 'text-fg' : isDone ? 'text-fg-muted' : isFailed ? 'text-danger' : 'text-fg-subtle',
                )}
              >
                {step.label}
              </span>

              {isActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-mono font-medium text-accent">
                  in progress
                </span>
              )}
            </div>

            {step.duration && (
              <span className="flex items-center gap-1 font-mono text-[11px] text-fg-subtle">
                <Clock className="size-3 text-fg-subtle" />
                {step.duration}
              </span>
            )}
          </div>

          {step.description && (
            <p className={cn('text-xs leading-relaxed', isActive ? 'text-fg-muted' : 'text-fg-subtle')}>
              {step.description}
            </p>
          )}

          {hasLogs && (
            <button
              type="button"
              onClick={() => setShowLogs((prev) => !prev)}
              className="mt-1 inline-flex w-fit items-center gap-1 font-mono text-[11px] text-accent hover:underline"
            >
              {showLogs ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              <span>{showLogs ? 'Hide Step Logs' : `Show Step Logs (${step.logs?.length || 0})`}</span>
            </button>
          )}

          {showLogs && hasLogs && (
            <ExecutionLogViewer logs={step.logs || []} title={`${step.label} Logs`} defaultOpen className="mt-2" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
