import { motion } from 'motion/react';
import { Check, Loader2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../design/cn';
import type { StepStatus } from '../../adapters/missionTypes';

export interface TimelineStepProps {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly status: StepStatus;
  readonly timestamp?: string;
  readonly index: number;
}

const statusConfig = {
  done: {
    icon: <Check className="size-3" />,
    ring: 'border-success/20 bg-success-soft text-success',
    label: 'text-fg-muted',
    desc: 'text-fg-subtle',
    line: 'bg-success/40',
  },
  active: {
    icon: <Loader2 className="size-3 animate-spin" />,
    ring: 'border-accent/40 bg-accent-soft text-accent shadow-[0_0_8px_rgba(212,175,55,0.15)]',
    label: 'text-fg',
    desc: 'text-fg-muted',
    line: 'bg-accent',
  },
  failed: {
    icon: <X className="size-3" />,
    ring: 'border-danger/20 bg-danger-soft text-danger',
    label: 'text-fg-muted',
    desc: 'text-fg-subtle',
    line: 'bg-danger/40',
  },
  pending: {
    icon: null,
    ring: 'border-border bg-bg-inset text-fg-subtle',
    label: 'text-fg-subtle',
    desc: 'text-fg-subtle/60',
    line: 'bg-border',
  },
};

export function TimelineStep({ label, description, status, timestamp, index, id }: TimelineStepProps): ReactNode {
  const config = statusConfig[status];
  const isActive = status === 'active';
  const isFirst = index === 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      className="relative flex items-start gap-3 pb-6 last:pb-0"
    >
      {!isFirst && (
        <div className={cn(
          'absolute left-[15px] top-0 bottom-6 w-px',
          config.line,
        )} />
      )}

      <div className="relative z-10 flex flex-col items-center">
        <div className={cn(
          'flex size-7 items-center justify-center rounded-full border transition-all duration-300',
          config.ring,
          isActive && 'animate-pulse',
        )}>
          {config.icon}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-start justify-between gap-2 pt-1">
        <div className="min-w-0">
          <span className={cn('text-sm font-medium leading-tight transition-colors duration-300', config.label)}>
            {label}
            {isActive && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="ml-2 text-[11px] font-normal text-accent"
              >
                in progress
              </motion.span>
            )}
          </span>
          {description && (status === 'active' || status === 'done' || status === 'failed') && (
            <div className={cn('mt-0.5 text-xs leading-tight', config.desc)}>
              {description}
            </div>
          )}
        </div>
        {timestamp && (
          <span className="shrink-0 text-[11px] text-fg-subtle">{timestamp}</span>
        )}
      </div>
    </motion.div>
  );
}
