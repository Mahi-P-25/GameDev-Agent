import type { StudioActivity, StudioCapability } from '@gamedev-agent/studio-api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStudioData } from '../../studio/StudioDataProvider';
import type { ModuleId, ModulePresence, PresenceEvent, PresenceStatus } from './PresenceEvents';
import { MODULE_META, MODULE_ORDER } from './PresenceEvents';

/**
 * A snapshot of the studio at a point in time, built entirely from real Nova
 * state (project, mission, active file, capabilities, workflow, health,
 * activity). No synthesized, fake, or AI-generated data is ever produced here.
 *
 * This snapshot is the single source of truth the presence cards render. When a
 * future AI system takes over, it can replace {@link resolveModules} while the
 * cards keep consuming the same {@link ModulePresence} shape.
 */
export interface PresenceSnapshot {
  readonly projectId: string | null;
  readonly projectName: string | null;
  readonly missionId: string | null;
  readonly missionTitle: string | null;
  readonly activeFile: string | null;
  readonly workflowRunning: boolean;
  readonly workflowCompleted: boolean;
  readonly workflowFailed: boolean;
  readonly workflowPhase: string | null;
  readonly capabilitiesTotal: number;
  readonly capabilitiesHealthy: number;
  readonly capabilitiesDegraded: number;
  readonly capabilitiesUnhealthy: number;
  readonly capabilities: ReadonlyArray<{ id: string; enabled: boolean; healthy: string }>;
  readonly goalInFlight: boolean;
  readonly goalTitle: string | null;
  readonly goalStatus: string | null;
  readonly pendingApprovals: number;
  readonly approvals: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly onboarding: boolean;
  readonly projectOptions: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly templates: ReadonlyArray<{
    readonly id: string;
    readonly kind: string;
    readonly name: string;
  }>;
  readonly recentWorkflows: ReadonlyArray<{ id: string; name: string; status: string }>;
  readonly recentFiles: ReadonlyArray<string>;
  readonly lastActivity: StudioActivity | null;
  readonly events: ReadonlyArray<PresenceEvent>;
  // --- runtime awareness (truthful, from the Nova Runtime) -----------------
  /** Real git branch the Runtime observed, or null when not a repo. */
  readonly runtimeBranch: string | null;
  /** Whether the working tree has modifications, per the Runtime. */
  readonly runtimeDirty: boolean;
  /** The package manager the Runtime detected from lockfiles. */
  readonly runtimePackageManager: string | null;
  /** Real build state (started/succeeded/failed/canceled) or null. */
  readonly runtimeBuildState: string | null;
  /** Real test state (started/passed/failed) or null. */
  readonly runtimeTestState: string | null;
  /** The most recently opened file the Runtime observed. */
  readonly runtimeLastOpenedFile: string | null;
  /** The absolute workspace root the Runtime is bound to. */
  readonly runtimeWorkspaceRoot: string | null;
  /** Coarse Runtime health (up/degraded/down/unknown). */
  readonly runtimeHealth: string | null;
}

function emptySnapshot(): PresenceSnapshot {
  return {
    projectId: null,
    projectName: null,
    missionId: null,
    missionTitle: null,
    activeFile: null,
    workflowRunning: false,
    workflowCompleted: false,
    workflowFailed: false,
    workflowPhase: null,
    capabilitiesTotal: 0,
    capabilitiesHealthy: 0,
    capabilitiesDegraded: 0,
    capabilitiesUnhealthy: 0,
    capabilities: [],
    goalInFlight: false,
    goalTitle: null,
    goalStatus: null,
    pendingApprovals: 0,
    approvals: [],
    onboarding: false,
    projectOptions: [],
    templates: [],
    recentWorkflows: [],
    recentFiles: [],
    lastActivity: null,
    events: [],
    runtimeBranch: null,
    runtimeDirty: false,
    runtimePackageManager: null,
    runtimeBuildState: null,
    runtimeTestState: null,
    runtimeLastOpenedFile: null,
    runtimeWorkspaceRoot: null,
    runtimeHealth: null,
  };
}

const statusRank: Record<PresenceStatus, number> = {
  working: 4,
  waiting: 3,
  blocked: 2,
  completed: 1,
  idle: 0,
};

/**
 * Derive each team module's presence status from the real snapshot. This is the
 * single function a future AI system would override to drive presence from its
 * own reasoning instead of these structural signals.
 */
export function resolveModules(snapshot: PresenceSnapshot): ReadonlyArray<ModulePresence> {
  const hasTerminal = snapshot.capabilities.some(
    (c) => c.id.includes('terminal') || c.id.includes('process'),
  );

  const statuses: Record<ModuleId, { status: PresenceStatus; detail?: string | undefined }> = {
    producer: {
      status: snapshot.goalInFlight ? 'working' : 'idle',
      detail: snapshot.goalInFlight ? 'Goal in flight' : 'No active goal',
    },
    planner: {
      status:
        snapshot.pendingApprovals > 0 ? 'waiting' : snapshot.goalInFlight ? 'working' : 'idle',
      detail:
        snapshot.pendingApprovals > 0
          ? `${snapshot.pendingApprovals} awaiting approval`
          : undefined,
    },
    workflow: {
      status: snapshot.workflowRunning
        ? 'working'
        : snapshot.workflowFailed
          ? 'blocked'
          : snapshot.workflowCompleted
            ? 'completed'
            : 'idle',
      detail: snapshot.workflowPhase ?? undefined,
    },
    qa: {
      status:
        snapshot.capabilitiesUnhealthy > 0
          ? 'blocked'
          : snapshot.capabilitiesDegraded > 0
            ? 'waiting'
            : 'idle',
      detail:
        snapshot.capabilitiesTotal > 0
          ? `${snapshot.capabilitiesHealthy}/${snapshot.capabilitiesTotal} healthy`
          : undefined,
    },
    terminal: {
      status: hasTerminal ? 'working' : 'idle',
      detail: hasTerminal ? 'Available' : 'Unavailable',
    },
    git: {
      status:
        snapshot.runtimeBranch === null ? 'idle' : snapshot.runtimeDirty ? 'waiting' : 'working',
      detail:
        snapshot.runtimeBranch === null
          ? 'No repository'
          : snapshot.runtimeDirty
            ? `On ${snapshot.runtimeBranch}, changes pending`
            : `On ${snapshot.runtimeBranch}`,
    },
  };

  return MODULE_ORDER.map((id) => ({
    id,
    name: MODULE_META[id].name,
    description: MODULE_META[id].description,
    status: statuses[id].status,
    detail: statuses[id].detail,
  }));
}

/** Convenience: the most active status across all modules (for the StatusBanner). */
export function overallStatus(modules: ReadonlyArray<ModulePresence>): PresenceStatus {
  return modules.reduce<PresenceStatus>(
    (acc, m) => (statusRank[m.status] > statusRank[acc] ? m.status : acc),
    'idle',
  );
}

/**
 * Subscribe to the studio and produce a live {@link PresenceSnapshot} plus the
 * derived {@link ModulePresence} list. Recomputes whenever the studio emits an
 * activity event, so presence reflects real, current state.
 */
export function useStudioPresence() {
  const { api } = useStudioData();
  const [snapshot, setSnapshot] = useState<PresenceSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!api) return;
    try {
      const home = api.getStudioHome?.();
      const ctx = api.getContext ? await api.getContext() : null;
      // Real Runtime awareness — truthful branch/build/test state, never assumed.
      const awareness = await api.runtime.getAwareness().catch(() => null);
      const activity = (home?.activity ?? (api.getActivity ? await api.getActivity() : [])) as
        | ReadonlyArray<StudioActivity>
        | undefined;
      const capabilities = (api.listCapabilities ? await api.listCapabilities() : []) as
        | ReadonlyArray<StudioCapability>
        | undefined;
      const missions = (api.listMissions ? api.listMissions() : []) as ReadonlyArray<{
        id: string;
        title: string;
        status: string;
        approvalPending?: boolean;
      }>;
      const projects = (api.listProjects ? api.listProjects() : []) as ReadonlyArray<{
        id: string;
        name: string;
      }>;

      if (!mounted.current) return;

      const caps = (capabilities ?? []).map((c) => ({
        id: String(c.id ?? ''),
        enabled: Boolean(c.enabled),
        healthy: String(c.health ?? 'unknown'),
      }));
      const healthyCount = caps.filter((c) => c.healthy === 'healthy').length;
      const degradedCount = caps.filter((c) => c.healthy === 'degraded').length;
      const unhealthyCount = caps.filter((c) => c.healthy === 'unhealthy').length;

      const pendingList = missions.filter(
        (m) => (m as unknown as { approvalPending?: boolean }).approvalPending,
      );
      const pendingApprovals = pendingList.length;
      const inFlight = missions.filter(
        (m) =>
          !['completed', 'failed', 'cancelled'].includes(
            (m as unknown as { status?: string }).status ?? '',
          ),
      ).length;

      const activeProject = projects.find((p) => p.id === ctx?.projectId) ?? projects[0];
      const activeMission =
        missions.find((m) => m.id === ctx?.missionId) ??
        missions.find(
          (m) =>
            !['completed', 'failed', 'cancelled'].includes(
              (m as unknown as { status?: string }).status ?? '',
            ),
        );

      const workflowCurrent = home?.workflowStatus?.current ?? null;
      const events: PresenceEvent[] = (activity ?? []).slice(0, 12).map((a, i) => ({
        id: String(a.seq ?? `evt-${i}`),
        message: a.message ?? a.kind ?? 'Activity',
        timestamp: a.timestamp ?? Date.now(),
        kind: a.kind ?? 'activity',
      }));

      const templates = (api.listWorkflowTemplates ? api.listWorkflowTemplates() : []).map((t) => ({
        id: String(t.id ?? ''),
        kind: String((t as unknown as { kind?: string }).kind ?? ''),
        name: String(t.name ?? t.id ?? 'Workflow'),
      }));

      setSnapshot({
        projectId: activeProject?.id ?? ctx?.projectId ?? null,
        projectName: activeProject?.name ?? null,
        missionId: activeMission?.id ?? null,
        missionTitle:
          (activeMission as unknown as { title?: string } | undefined)?.title ??
          home?.goal?.title ??
          null,
        activeFile: ctx?.activeFile ?? null,
        workflowRunning: Boolean(
          workflowCurrent?.state === 'running' || workflowCurrent?.state === 'planned',
        ),
        workflowCompleted: Boolean(workflowCurrent?.state === 'completed'),
        workflowFailed: Boolean(
          workflowCurrent?.state === 'failed' || workflowCurrent?.state === 'cancelled',
        ),
        workflowPhase: workflowCurrent?.state ?? null,
        capabilitiesTotal: caps.length,
        capabilitiesHealthy: healthyCount,
        capabilitiesDegraded: degradedCount,
        capabilitiesUnhealthy: unhealthyCount,
        capabilities: caps,
        goalInFlight: Boolean(home?.plannerStatus?.lastPlan || inFlight > 0),
        goalTitle: home?.goal?.title ?? null,
        goalStatus: home?.goal?.status ?? null,
        pendingApprovals,
        approvals: pendingList.map((m) => ({
          id: String((m as unknown as { id: string }).id ?? ''),
          title: String((m as unknown as { title: string }).title ?? ''),
        })),
        onboarding: Boolean(ctx?.onboarding) && projects.length === 0,
        projectOptions: projects.map((p) => ({ id: p.id, name: p.name })),
        templates,
        recentWorkflows: (ctx?.recentWorkflows ?? []).slice(0, 4).map((id) => ({
          id,
          name: id,
          status: 'recent' as string,
        })),
        recentFiles: ctx?.recentFiles ?? [],
        lastActivity: (activity ?? [])[0] ?? null,
        events,
        runtimeBranch: awareness?.branch ?? null,
        runtimeDirty: awareness?.dirty ?? false,
        runtimePackageManager: awareness?.packageManager ?? null,
        runtimeBuildState: awareness?.buildState ?? null,
        runtimeTestState: awareness?.testState ?? null,
        runtimeLastOpenedFile: awareness?.lastOpenedFile ?? null,
        runtimeWorkspaceRoot: awareness?.workspaceRoot ?? null,
        runtimeHealth: awareness?.health ?? null,
      });
    } catch {
      /* presence degrades to empty rather than crash the UI */
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

  const modules = useMemo(() => resolveModules(snapshot), [snapshot]);

  return {
    snapshot,
    modules,
    overall: overallStatus(modules),
    loading,
    refresh,
  };
}
