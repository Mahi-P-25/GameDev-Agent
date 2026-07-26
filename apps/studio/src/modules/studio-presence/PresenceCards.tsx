import {
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Goal as GoalIcon,
  Inbox,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Target,
  Terminal,
  Workflow,
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
import type { ModulePresence, PresenceStatus } from './PresenceEvents';
import { presenceIntent, presenceLabel } from './PresenceEvents';
import type { PresenceSnapshot } from './PresenceStore';

function timeAgo(ts: number | undefined): string {
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

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** A small, consistent uppercase eyebrow label used above every card value. */
function Eyebrow({ children }: { readonly children: ReactNode }) {
  return (
    <div className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{children}</div>
  );
}

/* ------------------------------------------------------------------ */
/* Greeting                                                            */
/* ------------------------------------------------------------------ */

export function Greeting({ snapshot }: { readonly snapshot: PresenceSnapshot }) {
  const name = snapshot.projectName ?? snapshot.projectId ?? 'Nova';
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          {greeting()}, {name}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          {snapshot.missionTitle
            ? `Working on ${snapshot.missionTitle}`
            : 'No active mission — the studio is calm and ready.'}
        </p>
      </div>
      <span className="inline-flex items-center gap-2 text-xs text-fg-subtle">
        <StatusIndicator intent="primary" pulse />
        Updated {timeAgo(snapshot.lastActivity?.timestamp)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StatusBanner                                                        */
/* ------------------------------------------------------------------ */

export function StatusBanner({
  overall,
  modules,
}: {
  readonly overall: PresenceStatus;
  readonly modules: ReadonlyArray<ModulePresence>;
}) {
  const working = modules.filter((m) => m.status === 'working').length;
  const blocked = modules.filter((m) => m.status === 'blocked').length;
  const waiting = modules.filter((m) => m.status === 'waiting').length;
  const intent: Intent =
    overall === 'blocked'
      ? 'danger'
      : overall === 'working'
        ? 'primary'
        : overall === 'waiting'
          ? 'warning'
          : 'neutral';

  const headline =
    overall === 'blocked'
      ? 'Attention needed'
      : overall === 'working'
        ? 'Studio is running'
        : overall === 'waiting'
          ? 'Studio is waiting'
          : 'Studio is idle';

  return (
    <Card className="flex items-center justify-between gap-4" inset>
      <div className="flex items-center gap-3">
        <StatusIndicator intent={intent} pulse={overall === 'working'} />
        <div>
          <div className="font-medium text-fg">{headline}</div>
          <div className="text-xs text-fg-muted">
            {working} working · {waiting} waiting · {blocked} blocked
          </div>
        </div>
      </div>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
          intent === 'danger' && 'border-danger/30 bg-danger-soft text-danger',
          intent === 'primary' && 'border-primary/30 bg-primary-soft text-primary',
          intent === 'warning' && 'border-warning/30 bg-warning-soft text-warning',
          intent === 'neutral' && 'border-border bg-bg-hover text-fg-muted',
        )}
      >
        {presenceLabel(overall)}
      </span>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* StatCard — the compact Project / Mission / File / Workflow tiles     */
/* ------------------------------------------------------------------ */

export function StatCard({
  icon,
  label,
  value,
  hint,
  onOpen,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
  readonly hint?: string | undefined;
  readonly onOpen?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-fg-subtle">
        <span className="grid size-7 place-items-center rounded-md bg-bg-inset">{icon}</span>
        <Eyebrow>{label}</Eyebrow>
      </div>
      <div className="mt-2 truncate text-lg font-semibold text-fg" title={value}>
        {value}
      </div>
      {hint !== undefined && <div className="mt-1 truncate text-xs text-fg-muted">{hint}</div>}
    </>
  );
  if (onOpen === undefined) {
    return <Card>{body}</Card>;
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-lg border border-border bg-bg-panel p-5 text-left shadow-sm transition-[border-color,box-shadow,transform] duration-base ease-standard hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base"
    >
      {body}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* HealthCard                                                          */
/* ------------------------------------------------------------------ */

export function HealthCard({ snapshot }: { readonly snapshot: PresenceSnapshot }) {
  const total = snapshot.capabilitiesTotal;
  const healthyPct = total > 0 ? Math.round((snapshot.capabilitiesHealthy / total) * 100) : 100;
  const intent: Intent =
    snapshot.capabilitiesUnhealthy > 0
      ? 'danger'
      : snapshot.capabilitiesDegraded > 0
        ? 'warning'
        : 'success';
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Eyebrow>Project Health</Eyebrow>
        <StatusIndicator intent={intent} />
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-2xl font-semibold tracking-tight text-fg">{healthyPct}%</span>
        <span className="pb-1 text-xs text-fg-muted">capabilities healthy</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <span className="text-success">{snapshot.capabilitiesHealthy} ok</span>
        <span className="text-fg-subtle">·</span>
        <span className="text-warning">{snapshot.capabilitiesDegraded} degraded</span>
        <span className="text-fg-subtle">·</span>
        <span className="text-danger">{snapshot.capabilitiesUnhealthy} down</span>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* TeamPresenceCard                                                    */
/* ------------------------------------------------------------------ */

const MODULE_ICON: Record<string, ReactNode> = {
  producer: <Sparkles className="size-4" />,
  planner: <Target className="size-4" />,
  workflow: <Workflow className="size-4" />,
  qa: <ShieldCheck className="size-4" />,
  terminal: <Terminal className="size-4" />,
  git: <GitBranch className="size-4" />,
};

export function TeamPresenceCard({ modules }: { readonly modules: ReadonlyArray<ModulePresence> }) {
  return (
    <Card title="Team Presence" subtitle="Who is doing what right now">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => {
          const intent = presenceIntent(m.status);
          return (
            <div
              key={m.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-bg-inset p-3"
            >
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-bg-hover text-fg-muted">
                {MODULE_ICON[m.id]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-fg">{m.name}</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                      intent === 'danger' && 'border-danger/30 bg-danger-soft text-danger',
                      intent === 'primary' && 'border-primary/30 bg-primary-soft text-primary',
                      intent === 'warning' && 'border-warning/30 bg-warning-soft text-warning',
                      intent === 'success' && 'border-success/30 bg-success-soft text-success',
                      intent === 'neutral' && 'border-border bg-bg-hover text-fg-muted',
                    )}
                  >
                    <StatusIndicator intent={intent} />
                    {presenceLabel(m.status)}
                  </span>
                </div>
                <div className="mt-1 truncate text-xs text-fg-muted">
                  {m.detail ?? m.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* ContinueCard                                                        */
/* ------------------------------------------------------------------ */

export function ContinueCard({
  snapshot,
  onContinue,
}: {
  readonly snapshot: PresenceSnapshot;
  readonly onContinue: () => void;
}) {
  const target = snapshot.missionTitle ?? snapshot.recentWorkflows[0]?.name ?? snapshot.projectName;
  const progress = snapshot.workflowRunning ? 50 : snapshot.workflowCompleted ? 100 : 0;
  const intent: Intent = snapshot.workflowRunning
    ? 'primary'
    : snapshot.workflowCompleted
      ? 'success'
      : 'neutral';
  return (
    <button
      type="button"
      onClick={onContinue}
      className="group w-full rounded-lg border border-border bg-bg-panel p-5 text-left shadow-sm transition-[border-color,box-shadow,transform] duration-base ease-standard hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>Continue Working</Eyebrow>
          <div className="mt-1 truncate text-base font-semibold text-fg">
            {target ?? 'Start something new'}
          </div>
        </div>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-bg-hover text-fg-muted transition-colors group-hover:text-fg">
          <ArrowRight className="size-4" />
        </span>
      </div>
      {target && <Progress value={progress} intent={intent} className="mt-3" />}
      <p className="mt-2 text-xs text-fg-muted">
        {snapshot.pendingApprovals > 0
          ? `${snapshot.pendingApprovals} item${snapshot.pendingApprovals > 1 ? 's' : ''} awaiting your approval`
          : target
            ? 'Pick up where you left off'
            : 'No in-flight work to resume'}
      </p>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* GoalCard                                                            */
/* ------------------------------------------------------------------ */

export function GoalCard({
  title,
  status,
}: {
  readonly title: string | null;
  readonly status: string | null;
}) {
  const intent: Intent =
    status === 'approved'
      ? 'success'
      : status === 'waiting_for_approval' || status === 'rejected'
        ? 'warning'
        : 'primary';
  return (
    <Card title="Today's Goal" subtitle="The studio objective">
      {title === null ? (
        <EmptyState
          icon={<GoalIcon className="size-5" />}
          title="No goal set"
          hint="Set a goal to give the studio direction."
        />
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium text-fg">{title}</div>
            {status !== null && (
              <span
                className={cn(
                  'mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                  intent === 'success' && 'border-success/30 bg-success-soft text-success',
                  intent === 'warning' && 'border-warning/30 bg-warning-soft text-warning',
                  intent === 'primary' && 'border-primary/30 bg-primary-soft text-primary',
                )}
              >
                {status.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-bg-inset text-fg-subtle">
            <GoalIcon className="size-4" />
          </span>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* QuickActionsCard                                                    */
/* ------------------------------------------------------------------ */

export function QuickActionsCard({
  templates,
  disabled,
  onRun,
}: {
  readonly templates: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly disabled: boolean;
  readonly onRun: (id: string) => void;
}) {
  return (
    <Card title="Quick Actions" subtitle="Run a developer workflow">
      {templates.length === 0 ? (
        <EmptyState icon={<PlayCircle className="size-5" />} title="No workflows available" />
      ) : (
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <Button
              key={t.id}
              variant="secondary"
              size="sm"
              disabled={disabled}
              leftIcon={<PlayCircle className="size-4" />}
              onClick={() => onRun(t.id)}
            >
              {t.name}
            </Button>
          ))}
        </div>
      )}
      {disabled && (
        <p className="mt-2 text-xs text-fg-subtle">Create a project first to run a workflow.</p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* ApprovalsCard                                                       */
/* ------------------------------------------------------------------ */

export function ApprovalsCard({
  approvals,
  onOpen,
}: {
  readonly approvals: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly onOpen: () => void;
}) {
  return (
    <Card
      title="Pending Approvals"
      subtitle="Missions awaiting your sign-off"
      actions={
        approvals.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-[10px] font-medium text-warning">
            <StatusIndicator intent="warning" />
            {approvals.length}
          </span>
        ) : undefined
      }
    >
      {approvals.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="size-5" />}
          title="Nothing to approve"
          hint="Approved missions flow straight into the studio."
        />
      ) : (
        <ul className="divide-y divide-border">
          {approvals.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={onOpen}
                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-fg">{a.title}</span>
                  <span className="block truncate text-xs text-fg-subtle">{a.id}</span>
                </span>
                <span className="shrink-0 rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-[10px] font-medium text-warning">
                  approval
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* ActivityCard                                                        */
/* ------------------------------------------------------------------ */

export function ActivityCard({ snapshot }: { readonly snapshot: PresenceSnapshot }) {
  return (
    <Card title="Recent Activity" subtitle="Live studio feed">
      {snapshot.events.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-5" />}
          title="No recent activity"
          hint="The studio will log events here as work progresses."
        />
      ) : (
        <ul className="space-y-1">
          {snapshot.events.map((e) => (
            <li key={e.id} className="flex items-start gap-3 rounded-md px-1 py-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-fg-subtle" />
              <span className="min-w-0 flex-1 truncate text-sm text-fg">{e.message}</span>
              <span className="shrink-0 text-xs text-fg-subtle">{timeAgo(e.timestamp)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton — loading state                                            */
/* ------------------------------------------------------------------ */

export function PresenceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}
