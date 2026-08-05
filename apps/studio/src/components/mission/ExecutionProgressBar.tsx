import { motion } from 'motion/react';
import { Clock, Layers, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ExecutionStatusBadge, type ExecutionStatus } from './ExecutionStatusBadge';

interface ExecutionProgressBarProps {
  readonly status: ExecutionStatus;
  readonly progress: number; // 0 to 100
  readonly currentStep: string;
  readonly stepCount: number;
  readonly completedStepCount: number;
  readonly startTime?: number;
}

export function ExecutionProgressBar({
  status,
  progress,
  currentStep,
  stepCount,
  completedStepCount,
  startTime,
}: ExecutionProgressBarProps): React.ReactNode {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!startTime || status === 'completed' || status === 'failed' || status === 'cancelled') {
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime, status]);

  const formatElapsed = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m > 0 ? `${m}m ` : ''}${s}s`;
  };

  const remainingSteps = Math.max(0, stepCount - completedStepCount);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative overflow-hidden rounded-2xl border border-border/80 bg-bg-panel/95 p-4 shadow-md backdrop-blur-xl"
    >
      {/* Top Header Row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid size-7 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
            <Sparkles className="size-4 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-fg">Mission Status:</span>
              <ExecutionStatusBadge status={status} />
            </div>
            <p className="mt-0.5 truncate font-mono text-[11px] text-fg-muted">
              {currentStep || 'Initializing execution engine…'}
            </p>
          </div>
        </div>

        {/* Metrics Pill Group */}
        <div className="flex items-center gap-3 text-xs font-mono text-fg-subtle shrink-0">
          <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-bg-surface px-2.5 py-1">
            <Layers className="size-3 text-accent" />
            <span>
              Step <strong className="text-fg">{completedStepCount}</strong>/{stepCount}
            </span>
            <span className="text-[10px] text-fg-subtle">({remainingSteps} left)</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-bg-surface px-2.5 py-1">
            <Clock className="size-3 text-accent" />
            <span className="font-semibold text-fg">{formatElapsed(elapsedSeconds)}</span>
          </div>

          <div className="rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 font-bold text-accent">
            {Math.round(progress)}%
          </div>
        </div>
      </div>

      {/* Progress Bar Track */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-bg-sunken border border-border/40">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent to-accent-strong shadow-[0_0_12px_rgba(214,179,88,0.6)]"
          initial={{ width: '0%' }}
          animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </motion.div>
  );
}
