import { motion } from 'motion/react';
import { useMemo, type ReactNode } from 'react';
import type { MissionEvent } from '../../adapters/missionTypes';
import { TimelineStep } from './TimelineStep';

interface MutableStep {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'active' | 'done' | 'failed';
  timestamp?: string;
}

function deriveTimelineState(events: ReadonlyArray<MissionEvent>) {
  const steps: MutableStep[] = [];

  for (const event of events) {
    if (event.type === 'step.started' && event.stepId) {
      const existing = steps.findIndex((s) => s.id === event.stepId);
      if (existing === -1) {
        steps.push({
          id: event.stepId,
          label: event.stepLabel ?? event.stepId,
          description: event.stepDescription ?? '',
          status: 'active',
          timestamp: event.timestamp,
        });
      }
    } else if (event.type === 'step.completed' && event.stepId) {
      const step = steps.find((s) => s.id === event.stepId);
      if (step) {
        step.status = 'done';
        step.timestamp = event.timestamp;
      }
    } else if (event.type === 'step.failed' && event.stepId) {
      const step = steps.find((s) => s.id === event.stepId);
      if (step) {
        step.status = 'failed';
        step.timestamp = event.timestamp;
      }
    }
  }

  const activeIndex = steps.findIndex((s) => s.status === 'active');
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const failedCount = steps.filter((s) => s.status === 'failed').length;
  const totalSteps = steps.length;

  return { steps, activeIndex, doneCount, failedCount, totalSteps };
}

export interface MissionTimelineProps {
  readonly events: ReadonlyArray<MissionEvent>;
  readonly missionText?: string;
}

export function MissionTimeline({ events, missionText }: MissionTimelineProps): ReactNode {
  const { steps, doneCount, failedCount, totalSteps } = useMemo(
    () => deriveTimelineState(events),
    [events],
  );

  const progress = totalSteps > 0 ? Math.round(((doneCount + failedCount) / totalSteps) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      {missionText && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2.5 border-b border-border pb-3"
        >
          <span className="flex size-4 items-center justify-center rounded-full bg-accent-soft">
            <span className="size-1.5 rounded-full bg-accent" />
          </span>
          <span className="text-sm font-medium text-fg line-clamp-1">{missionText}</span>
        </motion.div>
      )}

      <div className="relative h-1 overflow-hidden rounded-full bg-bg-inset">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-fg-subtle">
        <span>{totalSteps > 0 ? `${doneCount}/${totalSteps} steps complete` : 'No steps yet'}</span>
        {failedCount > 0 && <span className="text-danger">{failedCount} failed</span>}
      </div>

      <div className="relative flex flex-col">
        {steps.map((step, index) => (
          <TimelineStep
            key={step.id}
            id={step.id}
            label={step.label}
            description={step.description}
            status={step.status}
            timestamp={step.timestamp}
            index={index}
          />
        ))}
        {steps.length === 0 && (
          <div className="py-6 text-center text-sm text-fg-subtle">
            Waiting for mission to start...
          </div>
        )}
      </div>
    </div>
  );
}
