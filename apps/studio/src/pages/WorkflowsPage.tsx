import type { StudioWorkflowRun, StudioWorkflowTemplate } from '@gamedev-agent/studio-api';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '../components/layout/Page';
import {
  Badge,
  Card,
  EmptyState,
  ProgressBar,
  StatusDot,
  Tag,
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
    <Page
      title="Workflows"
      status={api.ready ? 'ready' : 'offline'}
      gridClass="nova-grid--dashboard"
    >
      <div className="nova-page-grid">
        {/* Available workflows */}
        <Card
          title="Available Workflows"
          subtitle="Reusable developer tasks"
          className="nova-col--4"
        >
          {templates.length === 0 ? (
            <EmptyState
              title="No workflows available"
              hint="The workflow engine is still booting."
            />
          ) : (
            <div className="nova-stack">
              {templates.map((t) => (
                <div key={t.id} className="nova-list__item" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    <div className="nova-subtle" style={{ fontSize: 12.5, marginTop: 2 }}>
                      {t.description}
                    </div>
                    <div className="nova-row" style={{ marginTop: 8, gap: 6, flexWrap: 'wrap' }}>
                      {t.steps.map((s) => (
                        <Tag key={s}>{s}</Tag>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="nova-btn nova-btn--primary"
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
            <div className="nova-row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
              <span className="nova-subtle" style={{ fontSize: 12 }}>
                Project:
              </span>
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`nova-btn nova-btn--ghost${p.id === activeProjectId ? ' nova-btn--active' : ''}`}
                  onClick={() => setProjectId(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {projects.length === 0 && (
            <div className="nova-subtle" style={{ fontSize: 12, marginTop: 10 }}>
              Create a project first to run a workflow against it.
            </div>
          )}
        </Card>

        {/* Running workflows */}
        <Card
          title="Running Workflows"
          subtitle="Live runs with progress"
          className="nova-col--8"
          actions={
            running.length > 0 ? (
              <Badge intent="info" dot>
                {running.length}
              </Badge>
            ) : undefined
          }
        >
          {running.length === 0 ? (
            <EmptyState title="Nothing running" hint="Start a workflow from Available Workflows." />
          ) : (
            <div className="nova-stack">
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

        {/* Completed workflows */}
        <Card
          title="Completed Workflows"
          subtitle="Finished runs this session"
          className="nova-col--6"
        >
          {completed.length === 0 ? (
            <EmptyState title="No completed runs yet" />
          ) : (
            <div className="nova-list">
              {completed.map((run) => (
                <RunRow key={run.id} run={run} onOpen={() => navigate('/workflows')} />
              ))}
            </div>
          )}
        </Card>

        {/* History */}
        <Card
          title="History"
          subtitle="Past runs (oldest outcomes preserved)"
          className="nova-col--6"
        >
          {history.length === 0 ? (
            <EmptyState title="No history yet" />
          ) : (
            <div className="nova-list">
              {history.map((run) => (
                <RunRow key={run.id} run={run} onOpen={() => navigate('/workflows')} />
              ))}
            </div>
          )}
        </Card>
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
    <div className="nova-card nova-card--inset">
      <div className="nova-row" style={{ justifyContent: 'space-between', gap: 8 }}>
        <div className="nova-row" style={{ gap: 8 }}>
          <StatusDot intent={workflowRunIntent(run.state)} />
          <div style={{ fontWeight: 600 }}>{workflowKindLabel(run.kind)}</div>
          <Badge intent={workflowRunIntent(run.state)} dot>
            {workflowRunLabel(run.state)}
          </Badge>
        </div>
        <button
          type="button"
          className="nova-btn nova-btn--danger"
          disabled={cancelling}
          onClick={onCancel}
        >
          {cancelling ? 'Cancelling…' : 'Cancel'}
        </button>
      </div>

      <div className="nova-row" style={{ marginTop: 10, gap: 10 }}>
        <div style={{ flex: 1 }}>
          <ProgressBar value={run.progress} intent={workflowRunIntent(run.state)} />
        </div>
        <span className="nova-mono" style={{ color: intentColor(workflowRunIntent(run.state)) }}>
          {run.progress}%
        </span>
      </div>

      <div className="nova-stack" style={{ marginTop: 12, gap: 6 }}>
        {run.steps.map((step) => (
          <div key={step.stepId} className="nova-row" style={{ gap: 8, fontSize: 12.5 }}>
            <StatusDot intent={workflowStepIntent(step.state)} />
            <span style={{ flex: 1 }}>{step.title}</span>
            <span className="nova-subtle">{workflowRunLabel(step.state)}</span>
            {step.error !== undefined && (
              <span className="nova-subtle" style={{ color: intentColor('danger') }}>
                {step.error}
              </span>
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
    <button type="button" className="nova-list__item nova-list__item--button" onClick={onOpen}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: intentColor(workflowRunIntent(run.state)),
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={{ fontWeight: 500 }}>{workflowKindLabel(run.kind)}</div>
        <div className="nova-subtle" style={{ fontSize: 11.5 }}>
          {run.steps.length} steps · {timeAgo(run.updatedAt)}
        </div>
      </div>
      <Badge intent={workflowRunIntent(run.state)} dot>
        {workflowRunLabel(run.state)}
      </Badge>
    </button>
  );
}
