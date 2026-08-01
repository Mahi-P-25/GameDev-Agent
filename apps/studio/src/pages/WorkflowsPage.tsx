import type { StudioWorkflowRun, StudioWorkflowTemplate } from '@gamedev-agent/studio-api';
import { CheckCircle2, History, PlayCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '../components/layout/Page';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { useStudioData } from '../studio/StudioDataProvider';
import {
  timeAgo,
  workflowKindLabel,
  workflowRunIntent,
  workflowRunLabel,
  workflowStepIntent,
} from './statusMaps';

/**
 * Workflows — the Development Workflows console.
 */
export function WorkflowsPage(): React.ReactNode {
  const { api } = useStudioData();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<ReadonlyArray<StudioWorkflowTemplate>>([]);
  const [runs, setRuns] = useState<ReadonlyArray<StudioWorkflowRun>>([]);
  const [history, setHistory] = useState<ReadonlyArray<StudioWorkflowRun>>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const projects = api.listProjects();
  const activeProjectId = projectId ?? projects[0]?.id ?? null;

  const refresh = useCallback(() => {
    if (!api.ready) {
      return;
    }
    setTemplates(api.listWorkflowTemplates());
    setRuns(api.listWorkflowRuns());
    setHistory(api.listWorkflowHistory());
  }, [api]);

  useEffect(() => {
    if (!api.ready) {
      const handle = setTimeout(refresh, 100);
      return () => clearTimeout(handle);
    }
    refresh();
    const hasRunning = runs.some((r) => r.state === 'running');
    if (!hasRunning) {
      return;
    }
    const handle = setInterval(refresh, 500);
    return () => clearInterval(handle);
  }, [api.ready, refresh, runs]);

  const start = useCallback(
    async (kind: StudioWorkflowTemplate['kind']) => {
      if (activeProjectId === null) {
        return;
      }
      setBusy(kind);
      try {
        await api.startWorkflow({ kind, projectId: activeProjectId });
        refresh();
      } finally {
        setBusy(null);
      }
    },
    [api, activeProjectId, refresh],
  );

  const cancel = useCallback(
    async (id: string) => {
      setBusy(id);
      try {
        await api.cancelWorkflow(id);
        refresh();
      } finally {
        setBusy(null);
      }
    },
    [api, refresh],
  );

  const running = useMemo(() => runs.filter((r) => r.state === 'running'), [runs]);
  const completed = useMemo(
    () =>
      runs.filter((r) => r.state !== 'running' && r.state !== 'created' && r.state !== 'planned'),
    [runs],
  );

  return (
    <Page title="Workflows">
      <div className="flex flex-col gap-5">
        {/* Available workflows */}
        <Card
          title="Available Workflows"
          subtitle="Reusable developer tasks"
          actions={<PlayCircle className="size-4 text-fg-subtle" />}
        >
          {templates.length === 0 ? (
            <EmptyState
              title="No workflows available"
              hint="The workflow engine is still booting."
            />
          ) : (
            <ul className="divide-y divide-border">
              {templates.map((t) => (
                <li key={t.id} className="flex items-start gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-fg">{t.name}</div>
                    <div className="mt-0.5 text-xs text-fg-muted">{t.description}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {t.steps.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center rounded-full border border-border bg-bg-inset px-2 py-0.5 text-[10px] text-fg-muted"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex shrink-0 items-center gap-2 rounded-md bg-accent px-4 py-1.5 text-xs font-semibold text-fg-on-accent transition-colors duration-fast hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                    disabled={busy !== null || activeProjectId === null}
                    onClick={() => start(t.kind)}
                  >
                    {busy === t.kind ? 'Starting…' : 'Run'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {projects.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <span className="text-xs text-fg-subtle">Project:</span>
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                    p.id === activeProjectId
                      ? 'border-border-accent bg-accent-soft text-accent'
                      : 'border-border text-fg-muted hover:border-border-strong hover:text-fg'
                  }`}
                  onClick={() => setProjectId(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {projects.length === 0 && (
            <p className="mt-3 text-xs text-fg-subtle">
              Create a project first to run a workflow against it.
            </p>
          )}
        </Card>

        {/* Running workflows */}
        <Card
          title="Running Workflows"
          subtitle="Live runs with progress"
          actions={
            running.length > 0 ? (
              <Badge intent="accent" dot>
                {running.length}
              </Badge>
            ) : undefined
          }
        >
          {running.length === 0 ? (
            <EmptyState title="Nothing running" hint="Start a workflow from Available Workflows." />
          ) : (
            <div className="space-y-4">
              {running.map((run) => (
                <RunCard
                  key={run.id}
                  run={run}
                  onCancel={() => cancel(run.id)}
                  cancelling={busy === run.id}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Completed workflows + History */}
        <div className="grid gap-5 md:grid-cols-2">
          <Card
            title="Completed"
            subtitle="Finished runs this session"
            actions={<CheckCircle2 className="size-4 text-fg-subtle" />}
          >
            {completed.length === 0 ? (
              <EmptyState title="No completed runs yet" />
            ) : (
              <ul className="divide-y divide-border">
                {completed.map((run) => (
                  <RunRow key={run.id} run={run} onOpen={() => navigate('/workflows')} />
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="History"
            subtitle="Past runs (oldest outcomes preserved)"
            actions={<History className="size-4 text-fg-subtle" />}
          >
            {history.length === 0 ? (
              <EmptyState title="No history yet" />
            ) : (
              <ul className="divide-y divide-border">
                {history.map((run) => (
                  <RunRow key={run.id} run={run} onOpen={() => navigate('/workflows')} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </Page>
  );
}

/** A live run card with progress, per-step breakdown, and cancel. */
function RunCard({
  run,
  onCancel,
  cancelling,
}: {
  run: StudioWorkflowRun;
  onCancel: () => void;
  cancelling: boolean;
}): React.ReactNode {
  return (
    <div className="rounded-lg border border-border bg-bg-inset p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusIndicator intent={workflowRunIntent(run.state)} pulse={run.state === 'running'} />
          <span className="text-sm font-semibold text-fg">{workflowKindLabel(run.kind)}</span>
          <Badge intent={workflowRunIntent(run.state)} dot size="sm">
            {workflowRunLabel(run.state)}
          </Badge>
        </div>
        <button
          type="button"
          className="rounded-md border border-danger/40 bg-danger-soft px-3 py-1 text-xs font-medium text-danger transition-colors duration-fast hover:bg-danger/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
          disabled={cancelling}
          onClick={onCancel}
        >
          {cancelling ? 'Cancelling…' : 'Cancel'}
        </button>
      </div>

      <div className="mt-2.5 flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-hover">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${run.progress}%`,
              background: 'var(--color-accent)',
            }}
          />
        </div>
        <span className="font-mono text-[11px] text-fg-muted">{run.progress}%</span>
      </div>

      <div className="mt-3 space-y-1.5">
        {run.steps.map((step) => (
          <div key={step.stepId} className="flex items-center gap-2 text-xs">
            <StatusIndicator intent={workflowStepIntent(step.state)} />
            <span className="flex-1 text-fg-muted">{step.title}</span>
            <span className="text-fg-subtle">{workflowRunLabel(step.state)}</span>
            {step.error !== undefined && <span className="text-danger">{step.error}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A compact row for a finished run (Completed / History). */
function RunRow({ run, onOpen }: { run: StudioWorkflowRun; onOpen: () => void }): React.ReactNode {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 py-3 text-left transition-opacity duration-fast hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-md"
      onClick={onOpen}
    >
      <StatusIndicator intent={workflowRunIntent(run.state)} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-fg">{workflowKindLabel(run.kind)}</div>
        <div className="text-[11px] text-fg-subtle">
          {run.steps.length} steps · {timeAgo(run.updatedAt)}
        </div>
      </div>
      <Badge intent={workflowRunIntent(run.state)} dot size="sm">
        {workflowRunLabel(run.state)}
      </Badge>
    </button>
  );
}
