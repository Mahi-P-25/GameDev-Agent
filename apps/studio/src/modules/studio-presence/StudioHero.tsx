import { ArrowRight, GitBranch } from 'lucide-react';
import type { ReactNode } from 'react';
import { ContextPanel, ContextStrip, Hero } from '../../components/primitives';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Progress } from '../../components/ui/Progress';
import { StatusIndicator } from '../../components/ui/StatusIndicator';
import { cn } from '../../design/cn';
import type { Intent } from '../../design/variants';
import { useStudioData } from '../../studio/StudioDataProvider';
import type { ModulePresence, PresenceEvent } from './PresenceEvents';
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

/**
 * StudioHero — the opening scene of the Nova operating system.
 *
 * The active project dominates the first viewport. Supporting context (the
 * now-playing Mission, the Team at work, Project health) sits quietly beneath,
 * and recent activity is a low-emphasis feed. Mission Control, approvals, quick
 * actions, and the project switcher are intentionally NOT on this screen —
 * they live behind ⌘K / their own routes, so the hero stays calm.
 *
 * All values come from the real PresenceSnapshot. No fabricated data.
 */
export function StudioHero({
  snapshot,
  onContinue,
  awayFor,
  suggestion,
  onSuggestion,
  live,
}: {
  readonly snapshot: PresenceSnapshot;
  readonly onContinue: () => void;
  /** Calm "while you were away" line, derived from real activity. Undefined = present. */
  readonly awayFor?: string | undefined;
  /** The single most useful next action, derived from real state. */
  readonly suggestion?: { readonly label: string; readonly to: string } | undefined;
  /** Called when the Director acts on the suggestion. */
  readonly onSuggestion?: (() => void) | undefined;
  /** When true the signature rule acknowledges live studio state. */
  readonly live?: boolean;
}): ReactNode {
  const projectName = snapshot.projectName ?? 'No project';
  const missionTitle = snapshot.missionTitle;
  const progress = snapshot.workflowRunning ? 50 : snapshot.workflowCompleted ? 100 : 0;
  const intent: Intent = snapshot.workflowRunning
    ? 'primary'
    : snapshot.workflowCompleted
      ? 'success'
      : 'neutral';

  return (
    <Hero signatureLive={live === true}>
      {/* Eyebrow: context, not a label */}
      <div className="flex items-center justify-between gap-4">
        <span className="font-headline text-2xs font-semibold uppercase tracking-wider text-fg-subtle">
          {awayFor !== undefined ? 'Welcome back' : 'Your Studio'}
        </span>
        {snapshot.projectOptions.length > 1 && (
          <ProjectSwitcher options={snapshot.projectOptions} />
        )}
      </div>

      {/* The hero — project name in display serif */}
      <div>
        <h1 className="font-display text-display leading-[0.95] tracking-tight text-fg">
          {projectName}
        </h1>
        <p className="mt-3 max-w-2xl text-md text-fg-muted">
          {missionTitle
            ? `The studio is building “${missionTitle}.” Pick up where the team left off.`
            : 'The studio is calm and ready. Set a direction to begin.'}
        </p>
        {awayFor !== undefined && (
          <p className="mt-1 text-sm text-fg-subtle">
            You were away for {awayFor}. The studio kept working.
          </p>
        )}
      </div>

      {/* Primary action — one clear verb */}
      <div className="flex items-center gap-3 pt-1">
        <Button
          variant="primary"
          size="lg"
          rightIcon={<ArrowRight className="size-4" />}
          onClick={onContinue}
        >
          {missionTitle ? 'Continue' : 'Open Mission Control'}
        </Button>
      </div>

      {missionTitle && (
        <div className="max-w-xl pt-2">
          <Progress value={progress} intent={intent} />
        </div>
      )}

      {/* One contextual next step — ambient intelligence, not a widget. */}
      {suggestion !== undefined && (
        <button
          type="button"
          onClick={onSuggestion ?? onContinue}
          className="nova-row group mt-1 gap-2 text-left text-sm text-fg-muted transition-colors duration-fast hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <ArrowRight className="size-3.5 text-primary transition-transform duration-fast group-hover:translate-x-0.5" />
          <span>{suggestion.label}</span>
        </button>
      )}
    </Hero>
  );
}

/** Compact project switcher — a context change, surfaced quietly in the hero. */
function ProjectSwitcher({
  options,
}: {
  readonly options: ReadonlyArray<{ readonly id: string; readonly name: string }>;
}): ReactNode {
  const { api } = useStudioData();
  return (
    <label className="inline-flex items-center gap-2 text-xs text-fg-subtle">
      <GitBranch className="size-3.5" />
      <select
        className="rounded-md border border-border bg-bg-inset px-2 py-1 text-xs text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        value={options.find((o) => o.id === api.getContext?.()?.projectId)?.id ?? ''}
        onChange={(e) => void api.setActiveProject?.(e.target.value)}
        aria-label="Switch active project"
      >
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * StudioContext — the quiet supporting strip beneath the hero.
 * Three panels: Now playing (Mission), Team (Roles), Health. Never competing.
 */
export function StudioContext({
  snapshot,
  modules,
}: {
  readonly snapshot: PresenceSnapshot;
  readonly modules: ReadonlyArray<ModulePresence>;
}): ReactNode {
  return (
    <ContextStrip>
      <ContextPanel title="Now playing">
        <div className="text-sm font-medium text-fg">
          {snapshot.missionTitle ?? 'No active mission'}
        </div>
        <div className="mt-1 text-xs text-fg-muted">
          {snapshot.activeFile ? `Editing ${snapshot.activeFile}` : 'Awaiting direction'}
        </div>
      </ContextPanel>

      <ContextPanel title="Team">
        <ul className="space-y-2">
          {modules.slice(0, 3).map((mod) => {
            const intent = presenceIntent(mod.status);
            return (
              <li key={mod.id} className="flex items-center justify-between gap-2">
                <span className="text-sm text-fg-muted">{mod.name}</span>
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
                  {presenceLabel(mod.status)}
                </span>
              </li>
            );
          })}
        </ul>
      </ContextPanel>

      <ContextPanel title="Health">
        {snapshot.capabilitiesTotal > 0 ? (
          <>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-semibold tracking-tight text-fg">
                {Math.round((snapshot.capabilitiesHealthy / snapshot.capabilitiesTotal) * 100)}%
              </span>
              <span className="pb-1 text-xs text-fg-muted">capabilities healthy</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <span className="text-success">{snapshot.capabilitiesHealthy} ok</span>
              <span className="text-warning">{snapshot.capabilitiesDegraded} degraded</span>
              <span className="text-danger">{snapshot.capabilitiesUnhealthy} down</span>
            </div>
          </>
        ) : (
          <div className="text-sm text-fg-subtle">No capabilities registered</div>
        )}
      </ContextPanel>

      <ContextPanel title="Workspace">
        {snapshot.runtimeWorkspaceRoot === null ? (
          <div className="text-xs text-fg-subtle">Runtime not observing a workspace</div>
        ) : (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-fg-muted">Branch</span>
              <span className="font-medium text-fg">
                {snapshot.runtimeBranch ?? 'no repo'}
                {snapshot.runtimeDirty && (
                  <span className="ml-1.5 rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning">
                    dirty
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-fg-muted">Build</span>
              <span className="font-medium text-fg">{snapshot.runtimeBuildState ?? 'unknown'}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-fg-muted">Tests</span>
              <span className="font-medium text-fg">{snapshot.runtimeTestState ?? 'unknown'}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-fg-muted">Package mgr</span>
              <span className="font-medium text-fg">
                {snapshot.runtimePackageManager ?? 'unknown'}
              </span>
            </div>
            {snapshot.runtimeLastOpenedFile !== null && (
              <div
                className="truncate pt-0.5 text-fg-subtle"
                title={snapshot.runtimeLastOpenedFile}
              >
                Last opened: {snapshot.runtimeLastOpenedFile}
              </div>
            )}
          </div>
        )}
      </ContextPanel>
    </ContextStrip>
  );
}

/** Quiet recent-activity feed. */
export function StudioActivity({ snapshot }: { readonly snapshot: PresenceSnapshot }): ReactNode {
  if (snapshot.events.length === 0) {
    return (
      <EmptyState
        icon={<GitBranch className="size-5" />}
        title="No recent activity"
        hint="The studio will log events here as work progresses."
      />
    );
  }
  return (
    <ul className="space-y-1">
      {snapshot.events.map((e: PresenceEvent) => (
        <li key={e.id} className="flex items-start gap-3 rounded-md px-1 py-2">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-fg-subtle" />
          <span className="min-w-0 flex-1 truncate text-sm text-fg">{e.message}</span>
          <span className="shrink-0 text-xs text-fg-subtle">{timeAgo(e.timestamp)}</span>
        </li>
      ))}
    </ul>
  );
}
