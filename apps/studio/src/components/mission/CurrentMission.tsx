import { FileCode2, Gauge, Swords, Target, Timer, Wrench } from 'lucide-react';
import { motion } from 'motion/react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import type { MissionPlan } from '../../adapters/missionPlannerTypes';
import type { MissionEvent } from '../../adapters/missionTypes';
import { cn } from '../../design/cn';
import { Card } from '../ui/Card';
import { StatusChip } from '../ui/StatusChip';

export interface CurrentMissionProps {
  readonly plan?: MissionPlan | null;
  readonly missionText?: string;
  readonly events?: ReadonlyArray<MissionEvent>;
  readonly className?: string;
}

const GOAL_LABELS: Record<string, string> = {
  'create-project': 'Create project',
  'bug-fix': 'Bug fix',
  performance: 'Performance',
  refactor: 'Refactor',
  analysis: 'Analysis',
  feature: 'Feature',
  unknown: 'General',
};

const ABILITY_LABELS: Record<string, string> = {
  'read-files': 'Read files',
  'write-files': 'Write files',
  'edit-files': 'Edit files',
  'search-text': 'Search',
  'run-terminal': 'Terminal',
  'build-project': 'Build',
  '3d-model': '3D modeling',
  'render-scene': 'Rendering',
  'inspect-workspace': 'Inspect workspace',
  'version-control-status': 'Version control',
};

function humanizeAbility(ability: string): string {
  return ABILITY_LABELS[ability] ?? ability.replace(/-/g, ' ');
}

function deriveProgress(events: ReadonlyArray<MissionEvent>): {
  done: number;
  total: number;
  failed: number;
} {
  const steps = new Map<string, 'done' | 'failed' | 'active'>();
  for (const event of events) {
    if (event.type === 'step.started' && event.stepId && !steps.has(event.stepId)) {
      steps.set(event.stepId, 'active');
    } else if (event.type === 'step.completed' && event.stepId) {
      steps.set(event.stepId, 'done');
    } else if (event.type === 'step.failed' && event.stepId) {
      steps.set(event.stepId, 'failed');
    }
  }
  const list = [...steps.values()];
  const done = list.filter((s) => s === 'done').length;
  const failed = list.filter((s) => s === 'failed').length;
  return { done, total: list.length, failed };
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * CurrentMission — the single, focused card for the mission running right now.
 * Goal, capability, tool, active file, elapsed time, and progress. The elapsed
 * clock ticks quietly and progress eases into place so the surface stays alive
 * without ever feeling busy.
 */
export function CurrentMission({
  plan,
  missionText,
  events = [],
  className,
}: CurrentMissionProps): ReactNode {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const { done, total, failed } = useMemo(() => deriveProgress(events), [events]);
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const goal = plan?.goal ?? 'unknown';
  const capability = plan?.requiredAbilities[0] ?? 'inspect-workspace';
  const tool = plan?.requiredTools[0]?.name ?? 'VS Code';
  const file = 'WebGLRenderer.tsx';

  const goalLabel = GOAL_LABELS[goal] ?? 'General';

  return (
    <Card
      title="Current Mission"
      subtitle={missionText}
      actions={
        <StatusChip
          intent={failed > 0 ? 'danger' : progress === 100 ? 'success' : 'accent'}
          pulse={progress < 100}
          label={failed > 0 ? 'failed' : progress === 100 ? 'complete' : 'in progress'}
        />
      }
      className={className}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <MetaCell icon={<Swords className="size-3.5" />} label="Goal" value={goalLabel} />
        <MetaCell
          icon={<Gauge className="size-3.5" />}
          label="Capability"
          value={humanizeAbility(capability)}
        />
        <MetaCell icon={<Wrench className="size-3.5" />} label="Tool" value={tool} />
        <MetaCell icon={<FileCode2 className="size-3.5" />} label="Active file" value={file} mono />
        <MetaCell
          icon={<Timer className="size-3.5" />}
          label="Elapsed"
          value={formatElapsed(elapsed)}
          mono
        />
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-bg-hover text-fg-muted">
            <Target className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium text-fg-subtle">Progress</span>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg-inset">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <span className="w-9 text-right font-mono text-[11px] tabular-nums text-fg-muted">
                {progress}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MetaCell({
  icon,
  label,
  value,
  mono = false,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}): ReactNode {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-bg-hover text-fg-muted">
        {icon}
      </span>
      <div className="min-w-0">
        <span className="block text-[11px] font-medium text-fg-subtle">{label}</span>
        <span
          className={cn('mt-0.5 block truncate text-[13px] text-fg', mono && 'font-mono text-xs')}
          title={value}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
