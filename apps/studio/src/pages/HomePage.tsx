import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgentStatusCard } from '../components/agent/AgentStatusCard';
import { LiveLogCard } from '../components/agent/LiveLogCard';
import { SystemMonitorCard } from '../components/agent/SystemMonitorCard';
import { CommandBar } from '../components/command-bar/CommandBar';
import { DetailPanel } from '../components/detail-panel/DetailPanel';
import { Page } from '../components/layout/Page';
import { MissionSummary } from '../components/mission/MissionSummary';
import { MissionTimeline } from '../components/timeline/MissionTimeline';
import { UpgradeBanner } from '../components/upgrade/UpgradeBanner';
import { MissionPlanner } from '../adapters/missionPlanner';
import type { MissionEvent } from '../adapters/missionTypes';
import type { MissionPlan } from '../adapters/missionPlannerTypes';
import { useStudioData } from '../studio/StudioDataProvider';

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

  const greeting = useCallback(() => {
    const h = new Date().getHours();
    if (h < 5) return 'Late night coding';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const isExecuting = phase === 'executing' || phase === 'review';

  const rightRail = isExecuting ? (
    <>
      <AgentStatusCard />
      <SystemMonitorCard />
      <LiveLogCard />
    </>
  ) : null;

  return (
    <Page rightRail={rightRail}>
      <div className="flex flex-col gap-8 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-[-0.03em] text-fg leading-[1.1]">
            {greeting()}
            <span className="block text-fg-muted text-[clamp(1rem,2vw,1.375rem)] font-normal tracking-[-0.01em] mt-2">
              What shall we build today?
            </span>
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <CommandBar onSubmit={handleExecute} />
        </motion.div>

        <AnimatePresence mode="wait">
          {phase === 'idle' && (
            <motion.div
              key="idle-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-bg-panel p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="size-4 text-accent" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                      Recent Activity
                    </span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { msg: 'Project analysis completed', time: '2m ago' },
                      { msg: 'Asset pipeline optimized', time: '1h ago' },
                      { msg: 'Build configuration updated', time: '3h ago' },
                    ].map((item) => (
                      <div key={item.msg} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-fg-subtle" />
                        <span className="text-fg-muted">{item.msg}</span>
                        <span className="ml-auto text-[11px] text-fg-subtle shrink-0">{item.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-bg-panel p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="size-4 text-fg-muted" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                      Studio Status
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-inset px-2.5 py-1 text-xs text-fg-muted">
                      <span className="size-1.5 rounded-full bg-success" />
                      All systems ready
                    </span>
                    <span className="text-xs text-fg-subtle">6 capabilities online</span>
                  </div>
                </div>
              </div>

              <UpgradeBanner />
            </motion.div>
          )}

          {phase === 'review' && plan && (
            <motion.div
              key="review-content"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
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
              className="flex flex-col gap-6"
            >
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-xl border border-border bg-bg-panel p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                      {complete ? 'Mission Complete' : 'Mission Timeline'}
                    </h2>
                    {complete && (
                      <span className="rounded-full border border-success/20 bg-success-soft px-2 py-0.5 text-[10px] text-success font-medium">
                        Complete
                      </span>
                    )}
                  </div>
                  <MissionTimeline events={missionEvents} missionText={missionText} />
                </div>

                <DetailPanel events={missionEvents} missionText={missionText} />
              </div>

              <UpgradeBanner />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Page>
  );
}
