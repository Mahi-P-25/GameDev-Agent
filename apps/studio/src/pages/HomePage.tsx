import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Page } from '../components/layout/Page';
import { StudioBackground } from '../components/hero/StudioBackground';
import { MissionInput } from '../components/hero/MissionInput';
import { ExecutionTimeline } from '../components/timeline/ExecutionTimeline';
import { MissionSummary } from '../components/mission/MissionSummary';
import { useStudioData } from '../studio/StudioDataProvider';
import { MissionPlanner } from '../adapters/missionPlanner';
import type { MissionEvent } from '../adapters/missionTypes';
import type { MissionPlan } from '../adapters/missionPlannerTypes';

type MissionPhase = 'idle' | 'review' | 'executing';

export function HomePage(): React.ReactNode {
  const { missionExecution } = useStudioData();
  const planner = useMemo(() => new MissionPlanner(), []);
  const [phase, setPhase] = useState<MissionPhase>('idle');
  const [complete, setComplete] = useState(false);
  const [missionText, setMissionText] = useState('');
  const [plan, setPlan] = useState<MissionPlan | null>(null);
  const [missionEvents, setMissionEvents] = useState<MissionEvent[]>([]);
  const resetTimerRef = useRef<number | null>(null);

  const handleExecute = useCallback((text: string) => {
    const trimmed = text.trim() || 'Untitled Mission';
    const newPlan = planner.plan(trimmed);
    setMissionText(trimmed);
    setPlan(newPlan);
    setPhase('review');
  }, [planner]);

  const handleConfirmExecute = useCallback(() => {
    if (!plan) return;
    setPhase('executing');
    setComplete(false);
    setMissionEvents([]);
    missionExecution.execute(plan);
  }, [plan, missionExecution]);

  const handleCancel = useCallback(() => {
    if (resetTimerRef.current !== null) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    setPhase('idle');
    setPlan(null);
    setMissionText('');
    setComplete(false);
    setMissionEvents([]);
  }, []);

  useEffect(() => {
    const disposable = missionExecution.onMissionEvent((event) => {
      setMissionEvents((prev) => [...prev, event]);
      if (event.type === 'mission.completed' || event.type === 'mission.failed') {
        setComplete(true);
        resetTimerRef.current = window.setTimeout(() => {
          setPhase('idle');
          setComplete(false);
          setPlan(null);
          setMissionText('');
          setMissionEvents([]);
          resetTimerRef.current = null;
        }, 3000);
      }
    });
    return () => {
      disposable.dispose();
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, [missionExecution]);

  const handleTimelineComplete = useCallback(() => {
    /* Already handled by the mission.completed event above */
  }, []);

  return (
    <Page>
      <StudioBackground />
      <div className="relative z-10 flex flex-col items-center gap-12">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="popLayout">
            {phase === 'idle' && (
              <motion.div
                key="mission-input"
                layoutId="mission-panel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <MissionInput onExecute={handleExecute} />
              </motion.div>
            )}

            {phase === 'review' && plan && (
              <motion.div
                key="mission-review"
                layoutId="mission-panel"
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <MissionSummary
                  plan={plan}
                  onExecute={handleConfirmExecute}
                  onCancel={handleCancel}
                />
              </motion.div>
            )}

            {phase === 'executing' && (
              <motion.div
                key="execution-panel"
                layoutId="mission-panel"
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="glass-panel-premium px-7 py-6">
                  <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8a8a]">
                    {complete ? 'Mission Complete' : 'Executing Mission'}
                  </h2>
                  <ExecutionTimeline events={missionEvents} missionText={missionText} onComplete={handleTimelineComplete} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex items-center gap-2 text-xs text-[#5c5c5c]"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#5bd88a]" />
          All systems ready
        </motion.div>
      </div>
    </Page>
  );
}
