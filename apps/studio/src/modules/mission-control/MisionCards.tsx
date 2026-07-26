import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock,
  GitBranch,
  ListChecks,
  Loader2,
  Network,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Loading';
import { Progress } from '../../components/ui/Progress';
import { StatusIndicator } from '../../components/ui/StatusIndicator';
import { cn } from '../../design/cn';
import type { Intent } from '../../design/variants';
import type {
  MissionDependency,
  MissionStatusKey,
  MissionView,
  Objective,
  ObjectiveStatus,
} from './MissionEvents';
import {
  dependencyIntent,
  missionStatusIntent,
  missionStatusLabel,
  objectiveStatusIntent,
  objectiveStatusLabel,
  priorityIntent,
} from './MissionEvents';

function timeAgo(ts: number | null | undefined): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return s <= 1 ? 'just now' : `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** A small, consistent uppercase eyebrow label used above every card value. */
function Eyebrow({ children }: { readonly children: ReactNode }) {
  return (
    <div className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{children}</div>
  );
}

/* ------------------------------------------------------------------ */
/* MissionStatus — compact status pill + progress summary                  */
/* ------------------------------------------------------------------ */

export function MissionStatus({
  statusKey,
  progress,
}: {
  readonly statusKey: MissionStatusKey;
  readonly progress: number;
}) {
  const intent = missionStatusIntent(statusKey);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        intent === 'danger' && 'border-danger/30 bg-danger-soft text-danger',
        intent === 'primary' && 'border-primary/30 bg-primary-soft text-primary',
        intent === 'warning' && 'border-warning/30 bg-warning-soft text-warning',
        intent === 'success' && 'border-success/30 bg-success-soft text-success',
        intent === 'neutral' && 'border-border bg-bg-hover text-fg-muted',
      )}
    >
      <StatusIndicator intent={intent} pulse={statusKey === 'working'} />
      {missionStatusLabel(statusKey)}
      <span className="text-fg-subtle">· {progress}%</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* ProgressTracker — the beautiful progress indicator                      */
/* ------------------------------------------------------------------ */

export function ProgressTracker({
  value,
  intent,
}: { readonly value: number; readonly intent: Intent }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-fg-muted">Progress</span>
        <span className="font-medium text-fg">{value}%</span>
      </div>
      <Progress value={value} intent={intent} size="md" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ObjectiveList — Pending / Working / Completed / Blocked             */
/* ------------------------------------------------------------------ */

const OBJECTIVE_ICON: Record<ObjectiveStatus, ReactNode> = {
  pending: <CircleDashed className="size-4" />,
  working: <Loader2 className="size-4 animate-spin" />,
  completed: <CheckCircle2 className="size-4" />,
  blocked: <AlertTriangle className="size-4" />,
};

export function ObjectiveList({ objectives }: { readonly objectives: ReadonlyArray<Objective> }) {
  const counts = objectives.reduce<Record<ObjectiveStatus, number>>(
    (acc, o) => {
      acc[o.status] += 1;
      return acc;
    },
    { pending: 0, working: 0, completed: 0, blocked: 0 },
  );

  return (
    <Card title="Objectives" subtitle="What this mission requires">
      {objectives.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="size-5" />}
          title="No objectives yet"
          hint="Submit a mission and the studio will break it into objectives."
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {(['working', 'pending', 'completed', 'blocked'] as const).map((k) => (
              <span
                key={k}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                  objectiveStatusIntent(k) === 'danger' &&
                    'border-danger/30 bg-danger-soft text-danger',
                  objectiveStatusIntent(k) === 'primary' &&
                    'border-primary/30 bg-primary-soft text-primary',
                  objectiveStatusIntent(k) === 'success' &&
                    'border-success/30 bg-success-soft text-success',
                  objectiveStatusIntent(k) === 'warning' &&
                    'border-warning/30 bg-warning-soft text-warning',
                  objectiveStatusIntent(k) === 'neutral' &&
                    'border-border bg-bg-hover text-fg-muted',
                )}
              >
                {counts[k]} {objectiveStatusLabel(k)}
              </span>
            ))}
          </div>
          <ul className="space-y-1.5">
            {objectives.map((o) => {
              const intent = objectiveStatusIntent(o.status);
              return (
                <li
                  key={o.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-bg-inset p-3"
                >
                  <span
                    className={cn(
                      'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md',
                      intent === 'danger' && 'bg-danger-soft text-danger',
                      intent === 'primary' && 'bg-primary-soft text-primary',
                      intent === 'success' && 'bg-success-soft text-success',
                      intent === 'warning' && 'bg-warning-soft text-warning',
                      intent === 'neutral' && 'bg-bg-hover text-fg-muted',
                    )}
                  >
                    {OBJECTIVE_ICON[o.status]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-fg">{o.title}</span>
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-fg-subtle">
                        {objectiveStatusLabel(o.status)}
                      </span>
                    </div>
                    {o.detail !== undefined && (
                      <p className="mt-0.5 text-xs text-fg-muted">{o.detail}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* DependencyView — real subsystem readiness                          */
/* ------------------------------------------------------------------ */

export function DependencyView({
  dependencies,
}: { readonly dependencies: ReadonlyArray<MissionDependency> }) {
  return (
    <Card title="Dependencies" subtitle="Subsystems this mission relies on">
      {dependencies.length === 0 ? (
        <EmptyState
          icon={<Network className="size-5" />}
          title="No dependencies reported"
          hint="The studio has not registered any subsystem dependencies yet."
        />
      ) : (
        <ul className="divide-y divide-border">
          {dependencies.map((d) => {
            const intent = dependencyIntent(d.status);
            return (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <StatusIndicator intent={intent} pulse={d.status === 'up'} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-fg">{d.name}</span>
                    {d.detail !== undefined && (
                      <span className="block truncate text-xs text-fg-subtle">{d.detail}</span>
                    )}
                  </span>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                    intent === 'success' && 'border-success/30 bg-success-soft text-success',
                    intent === 'warning' && 'border-warning/30 bg-warning-soft text-warning',
                    intent === 'danger' && 'border-danger/30 bg-danger-soft text-danger',
                    intent === 'neutral' && 'border-border bg-bg-hover text-fg-muted',
                  )}
                >
                  {d.status}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* NextStepCard — the answer to "what should I work on next?"         */
/* ------------------------------------------------------------------ */

export function NextStepCard({
  nextStep,
  onOpen,
}: {
  readonly nextStep: MissionView['nextStep'];
  readonly onOpen: () => void;
}) {
  if (nextStep === null) return null;
  const intent = nextStep.intent;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-lg border border-border bg-bg-panel p-5 text-left shadow-sm transition-[border-color,box-shadow,transform] duration-base ease-standard hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base"
    >
      <div className="flex items-center gap-2 text-fg-subtle">
        <Sparkles className="size-4" />
        <Eyebrow>Next Step</Eyebrow>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-lg font-semibold tracking-tight text-fg">
          {nextStep.label}
        </span>
        <span
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-full',
            intent === 'danger' && 'bg-danger-soft text-danger',
            intent === 'primary' && 'bg-primary-soft text-primary',
            intent === 'success' && 'bg-success-soft text-success',
            intent === 'warning' && 'bg-warning-soft text-warning',
            intent === 'neutral' && 'bg-bg-hover text-fg-muted',
          )}
        >
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* MissionCard — the full mission detail                            */
/* ------------------------------------------------------------------ */

export function MissionCard({ view }: { readonly view: MissionView }) {
  if (!view.hasMission || view.id === null) {
    return (
      <Card>
        <EmptyState
          icon={<CircleDot className="size-5" />}
          title="No active mission"
          hint="Submit a mission and Mission Control will track it here, end to end."
          action={
            <Button
              variant="primary"
              leftIcon={<Sparkles className="size-4" />}
              onClick={() => undefined}
            >
              New mission
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Eyebrow>Mission</Eyebrow>
            {view.priority !== null && (
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                  priorityIntent(view.priority) === 'danger' &&
                    'border-danger/30 bg-danger-soft text-danger',
                  priorityIntent(view.priority) === 'warning' &&
                    'border-warning/30 bg-warning-soft text-warning',
                  priorityIntent(view.priority) === 'neutral' &&
                    'border-border bg-bg-hover text-fg-muted',
                )}
              >
                {view.priority}
              </span>
            )}
          </div>
          <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-fg">
            {view.title}
          </h2>
        </div>
        <MissionStatus statusKey={view.statusKey} progress={view.progress} />
      </div>

      {view.description !== null && (
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">{view.description}</p>
      )}

      {view.blocker !== null && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{view.blocker}</span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <div className="flex items-center gap-2 text-sm">
          <GitBranch className="size-4 text-fg-subtle" />
          <span className="text-fg-muted">Project</span>
          <span className="truncate font-medium text-fg">
            {view.relatedProjectName ?? view.relatedProjectId ?? '—'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Network className="size-4 text-fg-subtle" />
          <span className="text-fg-muted">Workflow</span>
          <span className="truncate font-medium text-fg">{view.relatedWorkflowName ?? '—'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <CircleDot className="size-4 text-fg-subtle" />
          <span className="text-fg-muted">Status</span>
          <span className="font-medium text-fg">{view.statusRaw ?? view.statusKey}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="size-4 text-fg-subtle" />
          <span className="text-fg-muted">Last updated</span>
          <span className="font-medium text-fg">{timeAgo(view.lastUpdated)}</span>
        </div>
      </div>

      <div className="mt-4">
        <ProgressTracker value={view.progress} intent={missionStatusIntent(view.statusKey)} />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton — loading state                                            */
/* ------------------------------------------------------------------ */

export function MissionControlSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
