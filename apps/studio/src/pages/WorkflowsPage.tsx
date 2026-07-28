import type { StudioWorkflowRun, StudioWorkflowTemplate } from '@gamedev-agent/studio-api';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '../components/layout/Page';
import {
  Badge,
  StatusDot,
  intentColor,
} from '../components/ui/primitives';
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
 *
 * Surfaces the three reusable Development Workflows Nova can run for a developer:
 *  - **Available** — the templates you can start.
 *  - **Running** — live runs with progress, per-step state, and cancel.
 *  - **Completed** + **History** — finished runs with their outcome.
 *
 * Every run shows progress, emits `workflow.*` / `terminal.*` events (consumed by
 * the Studio activity feed), supports cancellation, and is written to an audit
 * log by the underlying tools. The page only ever reads from the Studio API
 * façade; it never imports a backend package.
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

  // Re-read once the kernel boots, and poll while anything is running so the
  // progress / step states advance as the workflow emits events.
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
      <div className="glass-panel space-y-6 p-6">
        {/* Available workflows */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
          <h2 className="text-sm font-semibold text-[#f5f5f5]">Available Workflows</h2>
          <p className="mt-0.5 text-xs text-[#8a8a8a]">Reusable developer tasks</p>
          {templates.length === 0 ? (
            <p className="mt-4 text-sm text-[#5c5c5c]">No workflows available. The workflow engine is still booting.</p>
          ) : (
            <div className="mt-4 divide-y divide-[rgba(255,255,255,0.06)]">
              {templates.map((t) => (
                <div key={t.id} className="flex items-start gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[#f5f5f5]">{t.name}</div>
                    <div className="mt-0.5 text-xs text-[#5c5c5c]">{t.description}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {t.steps.map((s) => (
                        <span key={s} className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 text-[10px] text-[#8a8a8a]">{s}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex shrink-0 items-center gap-2 rounded-xl bg-[#d4af37] px-4 py-2 text-xs font-semibold text-[#050505] transition-all duration-200 hover:bg-[#e4c458] hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                    disabled={busy !== null || activeProjectId === null}
                    onClick={() => start(t.kind)}
                  >
                    {busy === t.kind ? 'Starting…' : 'Run'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {projects.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#5c5c5c]">Project:</span>
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`rounded-lg border px-3 py-1 text-xs font-medium transition-all duration-200 ${
                    p.id === activeProjectId
                      ? 'border-[#d4af37] bg-[rgba(212,175,55,0.1)] text-[#d4af37]'
                      : 'border-[rgba(255,255,255,0.08)] text-[#8a8a8a] hover:border-[rgba(255,255,255,0.14)] hover:text-[#f5f5f5]'
                  }`}
                  onClick={() => setProjectId(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {projects.length === 0 && (
            <p className="mt-3 text-xs text-[#5c5c5c]">Create a project first to run a workflow against it.</p>
          )}
        </div>

        {/* Running workflows */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#f5f5f5]">Running Workflows</h2>
              <p className="mt-0.5 text-xs text-[#8a8a8a]">Live runs with progress</p>
            </div>
            {running.length > 0 && (
              <span className="inline-flex items-center rounded-full border border-[rgba(91,124,250,0.3)] bg-[rgba(91,124,250,0.1)] px-2 py-0.5 text-[10px] font-medium text-[#6ba8f5]">
                {running.length}
              </span>
            )}
          </div>
          {running.length === 0 ? (
            <p className="mt-4 text-sm text-[#5c5c5c]">Nothing running. Start a workflow from Available Workflows.</p>
          ) : (
            <div className="mt-4 space-y-4">
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
        </div>

        {/* Completed workflows + History */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
            <h2 className="text-sm font-semibold text-[#f5f5f5]">Completed Workflows</h2>
            <p className="mt-0.5 text-xs text-[#8a8a8a]">Finished runs this session</p>
            {completed.length === 0 ? (
              <p className="mt-4 text-sm text-[#5c5c5c]">No completed runs yet.</p>
            ) : (
              <div className="mt-4 divide-y divide-[rgba(255,255,255,0.06)]">
                {completed.map((run) => (
                  <RunRow key={run.id} run={run} onOpen={() => navigate('/workflows')} />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
            <h2 className="text-sm font-semibold text-[#f5f5f5]">History</h2>
            <p className="mt-0.5 text-xs text-[#8a8a8a]">Past runs (oldest outcomes preserved)</p>
            {history.length === 0 ? (
              <p className="mt-4 text-sm text-[#5c5c5c]">No history yet.</p>
            ) : (
              <div className="mt-4 divide-y divide-[rgba(255,255,255,0.06)]">
                {history.map((run) => (
                  <RunRow key={run.id} run={run} onOpen={() => navigate('/workflows')} />
                ))}
              </div>
            )}
          </div>
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
    <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusDot intent={workflowRunIntent(run.state)} />
          <span className="text-sm font-semibold text-[#f5f5f5]">{workflowKindLabel(run.kind)}</span>
          <Badge intent={workflowRunIntent(run.state)} dot>
            {workflowRunLabel(run.state)}
          </Badge>
        </div>
        <button
          type="button"
          className="rounded-lg border border-[rgba(255,94,94,0.3)] bg-[rgba(255,94,94,0.1)] px-3 py-1 text-xs font-medium text-[#ff5e5e] transition-all duration-200 hover:bg-[rgba(255,94,94,0.2)] disabled:opacity-50"
          disabled={cancelling}
          onClick={onCancel}
        >
          {cancelling ? 'Cancelling…' : 'Cancel'}
        </button>
      </div>

      <div className="mt-2.5 flex items-center gap-2.5">
        <div className="flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${run.progress}%`,
                background: intentColor(workflowRunIntent(run.state)),
              }}
            />
          </div>
        </div>
        <span className="text-[11px] font-mono text-[#8a8a8a]">{run.progress}%</span>
      </div>

      <div className="mt-3 space-y-1.5">
        {run.steps.map((step) => (
          <div key={step.stepId} className="flex items-center gap-2 text-xs">
            <StatusDot intent={workflowStepIntent(step.state)} />
            <span className="flex-1 text-[#f5f5f5]">{step.title}</span>
            <span className="text-[#5c5c5c]">{workflowRunLabel(step.state)}</span>
            {step.error !== undefined && (
              <span className="text-[#ff5e5e]">{step.error}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A compact row for a finished run (Completed / History). */
function RunRow({ run, onOpen }: { run: StudioWorkflowRun; onOpen: () => void }): React.ReactNode {
  return (
    <button type="button" className="flex w-full items-center gap-3 py-3 text-left transition-all duration-200 hover:opacity-80" onClick={onOpen}>
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: intentColor(workflowRunIntent(run.state)) }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[#f5f5f5]">{workflowKindLabel(run.kind)}</div>
        <div className="text-[11px] text-[#5c5c5c]">{run.steps.length} steps · {timeAgo(run.updatedAt)}</div>
      </div>
      <Badge intent={workflowRunIntent(run.state)} dot>
        {workflowRunLabel(run.state)}
      </Badge>
    </button>
  );
}
