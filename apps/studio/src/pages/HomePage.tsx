import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MissionPlanner } from '../adapters/missionPlanner';
import type { MissionPlan } from '../adapters/missionPlannerTypes';
import type { MissionEvent } from '../adapters/missionTypes';
import { ActivityFeed } from '../components/activity/ActivityFeed';
import { AgentStatusCard } from '../components/agent/AgentStatusCard';
import { SystemMonitorCard } from '../components/agent/SystemMonitorCard';
import { CommandBar } from '../components/command-bar/CommandBar';
import { DetailPanel } from '../components/detail-panel/DetailPanel';
import { Page } from '../components/layout/Page';
import { CurrentMission } from '../components/mission/CurrentMission';
import { MissionSummary } from '../components/mission/MissionSummary';
import { SystemStatus } from '../components/status/SystemStatus';
import { MissionTimeline } from '../components/timeline/MissionTimeline';
import { StatusChip } from '../components/ui/StatusChip';
import { UpgradeBanner } from '../components/upgrade/UpgradeBanner';
import { useStudioData } from '../studio/StudioDataProvider';

type MissionPhase = 'idle' | 'review' | 'executing';

const STAGGER = {
  animate: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};

const REVEAL = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
};

export function HomePage(): React.ReactNode {
  const { missionExecution } = useStudioData();
  const planner = useMemo(() => new MissionPlanner(), []);
  const [phase, setPhase] = useState<MissionPhase>('idle');
  const [complete, setComplete] = useState(false);
  const [missionText, setMissionText] = useState('');
  const [plan, setPlan] = useState<MissionPlan | null>(null);
  const [missionEvents, setMissionEvents] = useState<MissionEvent[]>([]);
  const resetTimerRef = useRef<number | null>(null);

  const handleExecute = useCallback(
    (text: string) => {
      const trimmed = text.trim() || 'Untitled Mission';
      const newPlan = planner.plan(trimmed);
      setMissionText(trimmed);
      setPlan(newPlan);
      setPhase('review');
    },
    [planner],
  );

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

  const greeting = useCallback(() => {
    const h = new Date().getHours();
    if (h < 5) return 'Late night coding';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const isExecuting = phase === 'executing' || phase === 'review';

  const heroLine =
    phase === 'executing'
      ? complete
        ? 'Mission complete'
        : 'Nova is working'
      : phase === 'review'
        ? 'Mission planned'
        : 'The studio is ready';

  const heroSub =
    phase === 'executing' || phase === 'review' ? missionText : 'What shall we build today?';

  const rightRail = isExecuting ? (
    <>
      <ActivityFeed />
      <AgentStatusCard />
      <SystemMonitorCard />
    </>
  ) : null;

  return (
    <Page rightRail={rightRail}>
      <motion.div {...STAGGER} className="flex flex-col gap-8 pb-8">
        {/* Hero — a quiet status statement, not a marketing banner. */}
        <motion.header
          {...REVEAL}
          className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 pt-6 text-center"
        >
          <div className="flex items-center gap-2">
            <StatusChip
              intent={phase === 'executing' ? 'accent' : 'success'}
              pulse={phase === 'executing' && !complete}
              label={heroLine}
              title={heroLine}
            />
          </div>
          <h1 className="text-balance text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-fg">
            {greeting()}
          </h1>
          <p className="text-balance text-[clamp(1rem,2vw,1.25rem)] leading-relaxed text-fg-muted">
            {heroSub}
          </p>
        </motion.header>

        {/* Command Bar — Nova's signature interaction. */}
        <motion.div {...REVEAL}>
          <CommandBar onSubmit={handleExecute} />
        </motion.div>

        <AnimatePresence mode="wait">
          {phase === 'idle' && (
            <motion.div
              key="idle-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mx-auto flex w-full max-w-2xl flex-col gap-5"
            >
              <SystemStatus className="mx-auto text-center" />
              <UpgradeBanner />
            </motion.div>
          )}

          {phase === 'review' && plan && (
            <motion.div
              key="review-content"
              initial={{ opacity: 0, y: 12, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto w-full max-w-2xl"
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
              key="executing-content"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex w-full max-w-5xl flex-col gap-6 self-center"
            >
              {/* Current Mission — the single focused card. */}
              <CurrentMission plan={plan} missionText={missionText} events={missionEvents} />

              {/* Timeline + detail in two columns. */}
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-lg border border-border bg-bg-panel shadow-sm">
                  <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                      Mission Timeline
                    </h2>
                    {complete && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success-soft px-2 py-0.5 text-[10px] font-medium text-success">
                        Complete
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <MissionTimeline events={missionEvents} missionText={missionText} />
                  </div>
                </div>

                <DetailPanel events={missionEvents} missionText={missionText} />
              </div>

              <UpgradeBanner />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </Page>
  );
}
