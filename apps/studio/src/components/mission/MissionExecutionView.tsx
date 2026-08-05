import { Play, Rocket, Sparkles, Terminal, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MissionPlanner } from '../../adapters/missionPlanner';
import type { MissionEvent } from '../../adapters/missionTypes';
import type { MissionPlan } from '../../adapters/missionPlannerTypes';
import { useStudioData } from '../../studio/StudioDataProvider';
import { CurrentMission } from './CurrentMission';
import { MissionSummary } from './MissionSummary';
import { MissionTimeline } from '../timeline/MissionTimeline';

const PROMPT_SUGGESTIONS: ReadonlyArray<string> = [
  'Create a WebGL renderer with shadow mapping',
  'Fix a crash when loading large scenes',
  'Refactor the physics step into an ECS system',
  'Profile and optimize frame times in the main loop',
];

function makeMissionId(): string {
  return `mission-${Date.now().toString(36)}`;
}

/**
 * MissionExecutionView — plan and execute a mission inline. Type a brief, Nova
 * plans the stages ({@link MissionPlanner}), and executing streams live
 * {@link MissionEvent}s into the animated {@link MissionTimeline}. A single
 * focused surface that shows the mission narrative unfolding in real time.
 */
export function MissionExecutionView(): React.ReactNode {
  const { missionExecution } = useStudioData();
  const [brief, setBrief] = useState('');
  const [plan, setPlan] = useState<MissionPlan | null>(null);
  const [events, setEvents] = useState<ReadonlyArray<MissionEvent>>([]);
  const [running, setRunning] = useState(false);
  const subscriptionRef = useRef<{ dispose: () => void } | null>(null);

  const planMission = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    const next = new MissionPlanner().plan(trimmed);
    setPlan({ ...next, missionId: makeMissionId() });
    setEvents([]);
    setRunning(false);
  }, []);

  const cancelMission = useCallback(() => {
    subscriptionRef.current?.dispose();
    subscriptionRef.current = null;
    setPlan(null);
    setEvents([]);
    setRunning(false);
  }, []);

  const executeMission = useCallback(async () => {
    if (plan === null) {
      return;
    }
    setEvents([]);
    setRunning(true);

    subscriptionRef.current?.dispose();
    subscriptionRef.current = missionExecution.onMissionEvent((event) => {
      setEvents((prev) => [...prev, event]);
    });

    try {
      await missionExecution.execute(plan);
    } catch (error) {
      setEvents((prev) => [
        ...prev,
        {
          type: 'mission.failed',
          timestamp: new Date().toLocaleTimeString([], { hour12: false }),
          missionText: error instanceof Error ? error.message : String(error),
          message: 'Mission execution crashed',
        },
      ]);
    } finally {
      setRunning(false);
    }
  }, [missionExecution, plan]);

  useEffect(() => {
    return () => {
      subscriptionRef.current?.dispose();
    };
  }, []);

  const lastMissionText = [...events].reverse().find((e) => e.missionText)?.missionText ?? plan?.summary;

  return (
    <div className="flex flex-col gap-5">
      {plan === null ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-bg-panel p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-fg">
            <Rocket className="size-4 text-accent" />
            New Mission
          </div>
          <p className="text-xs leading-relaxed text-fg-muted">
            Describe what you want Nova to do. The planner will decompose it into a mission plan with
            stages, then stream execution live below.
          </p>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Terminal className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
              <input
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    planMission(brief);
                  }
                }}
                placeholder="e.g. Add a fog pass to the WebGL renderer…"
                className="w-full rounded-lg border border-border bg-bg-inset py-2.5 pl-9 pr-3 text-sm text-fg outline-none transition-colors duration-fast placeholder:text-fg-subtle focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
              />
            </div>
            <button
              type="button"
              onClick={() => planMission(brief)}
              disabled={!brief.trim()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-xs font-semibold text-accent-fg shadow-sm transition-all duration-fast hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="size-3.5" />
              Plan mission
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-fg-subtle">Try:</span>
            {PROMPT_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setBrief(suggestion);
                  planMission(suggestion);
                }}
                className="rounded-full border border-border bg-bg-inset px-2.5 py-1 text-[11px] text-fg-muted transition-colors duration-fast hover:border-accent/40 hover:text-fg"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-fg">
              <Play className="size-4 text-accent" />
              Mission execution
            </div>
            {!running && (
              <button
                type="button"
                onClick={cancelMission}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-fg-subtle transition-colors duration-fast hover:bg-bg-hover hover:text-fg"
              >
                <X className="size-3" />
                Cancel
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <MissionTimeline
              events={events}
              {...(lastMissionText !== undefined ? { missionText: lastMissionText } : {})}
            />
            {events.length > 0 && (
              <CurrentMission
                plan={plan}
                events={events}
                {...(lastMissionText !== undefined ? { missionText: lastMissionText } : {})}
              />
            )}
          </div>

          {!running && plan !== null && (
            <MissionSummary
              plan={plan}
              onExecute={() => void executeMission()}
              onCancel={cancelMission}
            />
          )}
        </>
      )}
    </div>
  );
}
