import { motion } from 'motion/react';
import { Check, Loader2, Terminal, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import type { MissionEvent, TimelineStepState } from '../../adapters/missionTypes';

interface LogEntry {
  time: string;
  message: string;
  type: 'info' | 'done' | 'error';
}

interface ExecutionTimelineProps {
  readonly events: ReadonlyArray<MissionEvent>;
  readonly missionText?: string;
  readonly onComplete?: () => void;
}

interface MutableStep {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'active' | 'done' | 'failed';
}

function deriveTimelineState(events: ReadonlyArray<MissionEvent>) {
  const steps: MutableStep[] = [];
  const logs: LogEntry[] = [];
  let isComplete = false;

  for (const event of events) {
    if (event.type === 'step.started' && event.stepId && !steps.some((s) => s.id === event.stepId)) {
      steps.push({ id: event.stepId, label: event.stepLabel ?? '', description: event.stepDescription ?? '', status: 'active' });
    } else if (event.type === 'step.completed' && event.stepId) {
      const step = steps.find((s) => s.id === event.stepId);
      if (step) step.status = 'done';
    } else if (event.type === 'step.failed' && event.stepId) {
      const step = steps.find((s) => s.id === event.stepId);
      if (step) step.status = 'failed';
    }

    if (event.message) {
      logs.push({
        time: event.timestamp,
        message: event.message,
        type: event.type === 'step.failed' ? 'error' : event.type === 'step.completed' || event.type === 'mission.completed' ? 'done' : 'info',
      });
    }

    if (event.type === 'mission.completed' || event.type === 'mission.failed') {
      isComplete = true;
    }
  }

  const activeIndex = steps.findIndex((s) => s.status === 'active');
  const doneCount = steps.filter((s) => s.status === 'done' || s.status === 'failed').length;
  const progress = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0;

  return {
    steps: steps as TimelineStepState[],
    logs,
    activeIndex,
    isComplete,
    progress,
    doneCount,
  };
}

export function ExecutionTimeline({ events, missionText, onComplete }: ExecutionTimelineProps) {
  const consoleRef = useRef<HTMLDivElement>(null);
  const { steps, logs, activeIndex, isComplete, progress, doneCount } = useMemo(() => deriveTimelineState(events), [events]);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (isComplete) {
      onComplete?.();
    }
  }, [isComplete, onComplete]);

  return (
    <div className="flex flex-col gap-6">
      {missionText && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-2.5 border-b border-[rgba(255,255,255,0.06)] pb-4"
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-[rgba(212,175,55,0.1)]">
            <span className="size-1.5 rounded-full bg-[#d4af37]" />
          </span>
          <span className="text-sm font-medium text-[#f5f5f5] line-clamp-1">{missionText}</span>
        </motion.div>
      )}

      <div className="relative h-[3px] overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#d4af37] to-[#e4c458]"
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ boxShadow: '0 0 14px rgba(212,175,55,0.35)' }}
        />
      </div>

      <div className="relative flex flex-col">
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[rgba(255,255,255,0.06)]" />
        <div
          className="absolute left-[11px] top-2 w-px bg-gradient-to-b from-[#d4af37] to-[rgba(212,175,55,0.3)] transition-all duration-700 ease-out"
          style={{ height: `${steps.length > 0 ? (activeIndex >= 0 ? activeIndex : steps.length) / steps.length * 100 : 0}%` }}
        />

        {steps.map((step, index) => {
          const isActive = index === activeIndex;
          const isDone = step.status === 'done';
          const isFailed = step.status === 'failed';

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{
                opacity: isActive ? 1 : isDone || isFailed ? 0.55 : 0.25,
                x: 0,
              }}
              transition={{
                duration: 0.35,
                ease: [0.16, 1, 0.3, 1],
                delay: index * 0.04,
              }}
              className="relative flex items-start gap-4 pb-5 last:pb-0"
            >
              <div className="relative z-10 flex flex-col items-center">
                {isDone ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="flex size-6 items-center justify-center rounded-full border border-[rgba(91,216,138,0.2)] bg-[rgba(91,216,138,0.08)]"
                  >
                    <Check className="size-3 text-[#5bd88a]" />
                  </motion.div>
                ) : isFailed ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="flex size-6 items-center justify-center rounded-full border border-[rgba(255,80,80,0.2)] bg-[rgba(255,80,80,0.08)]"
                  >
                    <X className="size-3 text-[#ff5050]" />
                  </motion.div>
                ) : isActive ? (
                  <div className="relative flex size-6 items-center justify-center">
                    <motion.div
                      className="absolute inset-0 rounded-full bg-[#d4af37]"
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      style={{ opacity: 0.15 }}
                    />
                    <div className="relative flex size-6 items-center justify-center rounded-full border border-[rgba(212,175,55,0.5)] bg-[rgba(212,175,55,0.12)] shadow-[0_0_12px_rgba(212,175,55,0.2)]">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                        className="flex items-center justify-center"
                      >
                        <Loader2 className="size-3 text-[#d4af37]" />
                      </motion.div>
                    </div>
                  </div>
                ) : (
                  <div className="size-6 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]" />
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-[3px]">
                <span
                  className={`text-sm font-medium leading-tight transition-colors duration-300 ${
                    isActive ? 'text-[#f5f5f5]' : isDone || isFailed ? 'text-[#8a8a8a]' : 'text-[#5c5c5c]'
                  }`}
                >
                  {step.label}
                  {isActive && (
                    <motion.span
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="ml-2 text-[11px] font-normal text-[#d4af37]"
                    >
                      in progress
                    </motion.span>
                  )}
                  {isFailed && (
                    <span className="ml-2 text-[11px] font-normal text-[#ff5050]">
                      failed
                    </span>
                  )}
                </span>
                {(isActive || isDone || isFailed) && step.description && (
                  <span
                    className={`text-xs leading-tight transition-colors duration-300 ${
                      isActive ? 'text-[#8a8a8a]' : 'text-[#5c5c5c]'
                    }`}
                  >
                    {step.description}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden rounded-xl border border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.35)] backdrop-blur-sm"
      >
        <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.03)] px-4 py-2.5">
          <Terminal className="size-3.5 text-[#8a8a8a]" />
          <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#8a8a8a]">
            Tool Activity
          </span>
          {steps.length > 0 && (
            <span className="ml-auto text-[10px] text-[#5c5c5c]">
              step {doneCount}/{steps.length}
            </span>
          )}
        </div>
        <div
          ref={consoleRef}
          className="scrollbar-thin h-[152px] overflow-y-auto p-3 font-mono text-[11px] leading-[1.7]"
        >
          {logs.length === 0 && (
            <span className="text-[#5c5c5c]">Waiting for activity...</span>
          )}
          {logs.map((entry, i) => (
            <motion.div
              key={`${entry.time}-${i}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className={entry.type === 'done' ? 'text-[#6b8a6b]' : entry.type === 'error' ? 'text-[#ff5050]' : 'text-[#8a8a8a]'}
            >
              <span className="text-[#5c5c5c]">[{entry.time}]</span> {entry.message}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

