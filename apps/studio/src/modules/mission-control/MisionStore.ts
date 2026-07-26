import type { StudioActivity, StudioMission, StudioWorkflowRun } from '@gamedev-agent/studio-api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStudioData } from '../../studio/StudioDataProvider';
import {
  type MissionDependency,
  type MissionStatusKey,
  type MissionView,
  type NextStep,
  type Objective,
  normalizeMissionStatus,
} from './MissionEvents';

/**
 * A projection of the studio's current mission work, built entirely from real
 * Nova state (the active mission, its Coordinator requirements, the live workflow,
 * workspace dependencies, and the active project/context). No synthesized, fake,
 * or AI-generated data is produced here.
 *
 * This view is the single source of truth the Mission Control components render.
 * When a future AI system takes over, it can replace {@link resolveMission}
 * while every component keeps consuming the same {@link MissionView} shape.
 */
export interface MissionSnapshot {
  readonly mission: StudioMission | null;
  readonly missions: ReadonlyArray<StudioMission>;
  readonly workflow: StudioWorkflowRun | null;
  readonly dependencies: ReadonlyArray<MissionDependency>;
  readonly projectId: string | null;
  readonly projectName: string | null;
  readonly contextMissionId: string | null;
  readonly lastActivity: StudioActivity | null;
  readonly hasProjects: boolean;
}

function emptySnapshot(): MissionSnapshot {
  return {
    mission: null,
    missions: [],
    workflow: null,
    dependencies: [],
    projectId: null,
    projectName: null,
    contextMissionId: null,
    lastActivity: null,
    hasProjects: false,
  };
}

const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'done', 'success']);

/**
 * Derive the presentation-ready {@link MissionView} from the real snapshot.
 *
 * Objectives are projected from the Coordinator's `roleRequirements` (real output)
 * and their completion is distributed deterministically across `mission.progress`
 * — no invented copy. Dependencies come straight from workspace readiness.
 *
 * This is the ONE function a future AI system would override to drive mission
 * progress from its own reasoning instead of these structural signals.
 */
export function resolveMission(snapshot: MissionSnapshot): MissionView {
  const mission = snapshot.mission;
  const statusKey: MissionStatusKey = mission ? normalizeMissionStatus(mission.status) : 'pending';

  const blocker: string | null = mission?.failureReason ?? null;
  const approvalPending = mission?.approvalPending ?? false;

  // --- Objectives: real role requirements, distributed by progress ---------
  const requirements = mission?.roleRequirements ?? [];
  const progress = mission?.progress ?? 0;
  const pct = Math.max(0, Math.min(100, progress));
  const objectives: Objective[] = requirements.map((req, i) => {
    let status: Objective['status'] = 'pending';
    if (blocker !== null || statusKey === 'blocked') {
      status = 'blocked';
    } else if (statusKey === 'completed' || statusKey === 'cancelled') {
      status = statusKey === 'completed' ? 'completed' : 'pending';
    } else if (requirements.length > 0) {
      // A requirement is "complete" once its slice of the progress bar is done.
      const per = 100 / requirements.length;
      const threshold = (i + 1) * per - 1;
      if (pct >= threshold) status = 'completed';
      else if (pct >= i * per) status = 'working';
      else status = 'pending';
    }
    return {
      id: `${mission?.id ?? 'm'}-obj-${i}`,
      title: req.role,
      detail: req.rationale,
      status,
    };
  });

  // --- Related workflow ---------------------------------------------------
  const workflow = snapshot.workflow;
  const relatedWorkflowId = workflow?.id ?? null;
  const relatedWorkflowName = workflow !== null ? `${workflow.kind} · ${workflow.state}` : null;

  // --- Next step: the one answer to "what should I work on next?" -----
  const nextStep: NextStep | null = (() => {
    if (mission === null) {
      return { label: 'Submit a mission to get started', to: '/missions', intent: 'primary' };
    }
    if (approvalPending) {
      return { label: `Approve "${mission.title}"`, to: '/missions', intent: 'warning' };
    }
    if (blocker !== null) {
      return { label: `Resolve blocker: ${blocker}`, to: '/missions', intent: 'danger' };
    }
    if (statusKey === 'completed') {
      return { label: 'Mission complete — start the next one', to: '/missions', intent: 'success' };
    }
    if (statusKey === 'working') {
      const next = objectives.find((o) => o.status !== 'completed');
      return {
        label: next ? `Continue: ${next.title}` : 'Keep working on this mission',
        to: '/missions',
        intent: 'primary',
      };
    }
    return { label: `Start: ${mission.title}`, to: '/missions', intent: 'primary' };
  })();

  return {
    id: mission?.id ?? null,
    title: mission?.title ?? null,
    description: mission?.brief ?? null,
    priority: mission?.priority ?? null,
    statusKey,
    statusRaw: mission?.status ?? null,
    progress: pct,
    approvalPending,
    blocker,
    objectives,
    dependencies: snapshot.dependencies,
    relatedProjectId: snapshot.projectId,
    relatedProjectName: snapshot.projectName,
    relatedWorkflowId,
    relatedWorkflowName,
    lastUpdated: mission?.updatedAt ?? null,
    nextStep,
    hasMission: mission !== null,
  };
}

/**
 * Subscribe to the studio and produce a live {@link MissionSnapshot} plus the
 * derived {@link MissionView}. Recomputes whenever the studio emits an activity
 * event, so Mission Control reflects real, current state without polling.
 */
export function useMissionControl() {
  const { api } = useStudioData();
  const [snapshot, setSnapshot] = useState<MissionSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!api) return;
    try {
      const ctx = api.getContext ? await api.getContext() : null;
      const missions = (api.listMissions ? api.listMissions() : []) as ReadonlyArray<StudioMission>;
      const runs = (api.listWorkflowRuns ? api.listWorkflowRuns() : []) as
        | ReadonlyArray<StudioWorkflowRun>
        | undefined;
      const projects = api.listProjects ? api.listProjects() : [];
      const workspace = api.getWorkspace ? api.getWorkspace() : null;
      const activity = api.getActivity ? await api.getActivity(1) : [];

      if (!mounted.current) return;

      const active =
        missions.find((m) => m.id === ctx?.missionId) ??
        missions.find((m) => !TERMINAL.has((m.status ?? '').toLowerCase())) ??
        missions[0] ??
        null;

      const workflow = (runs ?? []).find((r) => !TERMINAL.has(r.state)) ?? (runs ?? [])[0] ?? null;
      const activeProject = projects.find((p) => p.id === ctx?.projectId) ?? projects[0];

      const dependencies: MissionDependency[] = (workspace?.dependencies ?? []).map((d) => ({
        id: d.name,
        name: d.name,
        status: d.status,
        detail: d.detail,
      }));

      setSnapshot({
        mission: active,
        missions,
        workflow,
        dependencies,
        projectId: activeProject?.id ?? ctx?.projectId ?? null,
        projectName: activeProject?.name ?? null,
        contextMissionId: ctx?.missionId ?? null,
        lastActivity: (activity ?? [])[0] ?? null,
        hasProjects: projects.length > 0,
      });
    } catch {
      /* mission control degrades to empty rather than crash the UI */
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const disposable = api?.onActivity?.(() => void refresh());
    return () => {
      mounted.current = false;
      disposable?.dispose?.();
    };
  }, [api, refresh]);

  const view = useMemo(() => resolveMission(snapshot), [snapshot]);

  return {
    snapshot,
    view,
    loading,
    refresh,
  };
}
