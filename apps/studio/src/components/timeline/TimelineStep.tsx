import { Check, Loader2, X } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import type { StepStatus } from '../../adapters/missionTypes';
import { cn } from '../../design/cn';

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
    ring: 'border-success/30 bg-success-soft text-success',
    label: 'text-fg-muted',
    desc: 'text-fg-subtle',
    line: 'bg-success/35',
  },
  active: {
    icon: <Loader2 className="size-3 animate-spin" />,
    ring: 'border-border-accent bg-accent-soft text-accent',
    label: 'text-fg',
    desc: 'text-fg-muted',
    line: 'bg-accent',
  },
  failed: {
    icon: <X className="size-3" />,
    ring: 'border-danger/25 bg-danger-soft text-danger',
    label: 'text-fg-muted',
    desc: 'text-fg-subtle',
    line: 'bg-danger/35',
  },
  pending: {
    icon: null,
    ring: 'border-border bg-bg-inset text-fg-subtle',
    label: 'text-fg-subtle',
    desc: 'text-fg-subtle',
    line: 'bg-border',
  },
};

export function TimelineStep({
  label,
  description,
  status,
  timestamp,
  index,
}: TimelineStepProps): ReactNode {
  const config = statusConfig[status];
  const isActive = status === 'active';

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex items-start gap-4 pb-6 last:pb-0"
    >
      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          initial={false}
          animate={isActive ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={{
            duration: 0.4,
            repeat: isActive ? Number.POSITIVE_INFINITY : 0,
            repeatDelay: 1.4,
            ease: 'easeInOut',
          }}
          className={cn(
            'flex size-[22px] items-center justify-center rounded-full border transition-colors duration-300',
            config.ring,
          )}
        >
          {config.icon}
        </motion.div>
      </div>

      <div className="flex min-w-0 flex-1 items-start justify-between gap-2 pt-[1px]">
        <div className="min-w-0">
          <span
            className={cn(
              'text-sm leading-tight transition-colors duration-300',
              config.label,
              isActive && 'font-medium',
            )}
          >
            {label}
          </span>
          {description && (status === 'active' || status === 'done' || status === 'failed') && (
            <div className={cn('mt-0.5 text-xs leading-snug', config.desc)}>{description}</div>
          )}
        </div>
        {timestamp && (
          <span className="shrink-0 font-mono text-[11px] text-fg-subtle">{timestamp}</span>
        )}
      </div>
    </motion.div>
  );
}
