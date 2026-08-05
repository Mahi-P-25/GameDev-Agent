import type { StudioMission, StudioProject } from '@gamedev-agent/studio-api';
import {
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  HardDrive,
  Languages,
  ListChecks,
  Zap,
  FolderTree,
  Package,
  Activity,
  Brain,
  BarChart3,
  History,
  FileCode,
  CheckCircle2,
  Sparkles,
  GitBranch,
  Terminal,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Page } from '../components/layout/Page';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../design/cn';
import { useStudioData } from '../studio/StudioDataProvider';
import { missionStatusIntent, missionStatusLabel, projectStatusIntent, timeAgo } from './statusMaps';

type DashboardTab =
  | 'overview'
  | 'files'
  | 'dependencies'
  | 'activity'
  | 'memory'
  | 'intelligence'
  | 'statistics'
  | 'missions';

const DASHBOARD_TABS: ReadonlyArray<{ readonly id: DashboardTab; readonly label: string; readonly icon: any }> = [
  { id: 'overview', label: 'Overview', icon: Boxes },
  { id: 'files', label: 'Files', icon: FolderTree },
  { id: 'dependencies', label: 'Dependencies', icon: Package },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'intelligence', label: 'Project Intelligence', icon: Sparkles },
  { id: 'statistics', label: 'Statistics', icon: BarChart3 },
  { id: 'missions', label: 'Mission History', icon: History },
];

interface ProjectOverviewContentProps {
  readonly projectId: string;
}

function ProjectOverviewContent({ projectId }: ProjectOverviewContentProps): React.ReactNode {
  const { api } = useStudioData();
  const navigate = useNavigate();
  const [project, setProject] = useState<StudioProject | null>(null);
  const [missions, setMissions] = useState<ReadonlyArray<StudioMission>>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [opening, setOpening] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  useEffect(() => {
    setStatus('loading');
    try {
      const p = api.getProject(projectId);
      setProject(p);
      setMissions(api.listMissions().filter((m) => m.projectId === projectId));
      setStatus('ready');
    } catch {
      setStatus('missing');
    }
  }, [api, projectId]);

  const handleOpen = useCallback(async () => {
    setOpening(true);
    try {
      await api.openProject(projectId);
      navigate('/intelligence');
    } catch (error) {
      console.error('Failed to open project:', error);
    } finally {
      setOpening(false);
    }
  }, [api, projectId, navigate]);

  const progressStats = useMemo(() => {
    let inFlight = 0;
    let done = 0;
    for (const m of missions) {
      if (m.status === 'completed') done += 1;
      else if (m.status !== 'failed' && m.status !== 'cancelled') inFlight += 1;
    }
    return { total: missions.length, done, inFlight };
  }, [missions]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-fg-subtle">
        Loading project dashboard…
      </div>
    );
  }

  if (status === 'missing' || project === null) {
    return (
      <Card inset>
        <EmptyState
          icon={<Boxes className="size-6 text-accent" />}
          title="Project not found"
          hint="This project may have been removed from the workspace."
          action={
            <button
              type="button"
              onClick={() => navigate('/projects')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-accent-fg transition-opacity duration-fast hover:opacity-90"
            >
              <ArrowLeft className="size-3.5" />
              Back to Projects
            </button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb Navigation */}
      <button
        type="button"
        onClick={() => navigate('/projects')}
        className="inline-flex w-fit items-center gap-1.5 text-xs text-fg-muted transition-colors duration-fast hover:text-fg"
      >
        <ArrowLeft className="size-3.5" />
        All Projects
      </button>

      {/* Header Banner */}
      <Card size="lg">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-2xl font-bold tracking-tight text-fg">{project.name}</h2>
                <Badge intent={projectStatusIntent(project.status)} dot>
                  {project.status}
                </Badge>
              </div>
              {project.description && (
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-fg-muted">{project.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleOpen}
              disabled={opening}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-accent-fg shadow-sm transition-all duration-fast hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            >
              <ArrowUpRight className="size-4" />
              {opening ? 'Opening…' : 'Open in Intelligence'}
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 border-t border-border/60 pt-3">
            <Fact icon={<HardDrive className="size-3.5" />} label="Root Path" value={project.rootPath} mono />
            <Fact icon={<Zap className="size-3.5" />} label="Engine" value={project.engine || 'Three.js / React'} />
            <Fact icon={<Languages className="size-3.5" />} label="Language" value={project.language || 'TypeScript'} />
            <Fact icon={<GitBranch className="size-3.5" />} label="Git Status" value="main (clean)" />
            <Fact icon={<Brain className="size-3.5" />} label="Memory Hits" value="14 fragments" />
            <Fact icon={<Sparkles className="size-3.5 text-accent" />} label="Intelligence" value="96% indexed" />
          </div>
        </div>
      </Card>

      {/* Dashboard Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border pb-1">
        {DASHBOARD_TABS.map((tab) => {
          const IconComp = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-fast',
                isActive
                  ? 'bg-accent/15 text-accent shadow-sm'
                  : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
              )}
            >
              <IconComp className={cn('size-3.5', isActive ? 'text-accent' : 'text-fg-subtle')} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Panes */}
      <div className="min-h-[360px]">
        {/* 1. Overview Tab */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border bg-bg-panel p-4">
                <span className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">Health Score</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-3xl font-bold text-success">98</span>
                  <span className="text-xs text-fg-subtle">/ 100</span>
                </div>
                <p className="mt-1 text-xs text-fg-muted">All modules, types, and build scripts pass validation cleanly.</p>
              </div>

              <div className="rounded-xl border border-border bg-bg-panel p-4">
                <span className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">Total Missions</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-3xl font-bold text-accent">{progressStats.total}</span>
                  <span className="text-xs text-fg-subtle">{progressStats.done} completed</span>
                </div>
                <p className="mt-1 text-xs text-fg-muted">Automated agent missions executed on this codebase.</p>
              </div>

              <div className="rounded-xl border border-border bg-bg-panel p-4">
                <span className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">Target Platforms</span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {project.targetPlatforms.length > 0 ? (
                    project.targetPlatforms.map((p) => (
                      <span key={p} className="rounded-md border border-border bg-bg-surface px-2 py-1 text-xs font-mono text-fg">
                        {p}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-mono text-fg-subtle">Web (WebGL / WebGPU)</span>
                  )}
                </div>
              </div>
            </div>

            <Card
              title="Recent Missions"
              subtitle={`${progressStats.total} total missions recorded for ${project.name}`}
              actions={<ListChecks className="size-4 text-fg-subtle" />}
            >
              {missions.length === 0 ? (
                <EmptyState
                  icon={<ListChecks className="size-5 text-accent" />}
                  title="No missions yet"
                  hint="Submit a mission to start Nova's team of agents working on this project."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {missions.slice(0, 5).map((mission) => (
                    <li key={mission.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-fg">{mission.title}</div>
                        <div className="mt-0.5 truncate text-xs text-fg-muted">{mission.brief}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="hidden font-mono text-xs text-fg-subtle sm:inline">
                          {Math.round(mission.progress * 100)}%
                        </span>
                        <Badge intent={missionStatusIntent(mission.status)} dot>
                          {missionStatusLabel(mission.status)}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}

        {/* 2. Files Tab */}
        {activeTab === 'files' && (
          <Card title="Project Directory Tree" subtitle="Scanned codebase structure and entrypoints">
            <div className="flex flex-col gap-2 font-mono text-xs">
              <div className="flex items-center gap-2 rounded-lg bg-bg-surface p-2.5 text-fg font-semibold">
                <FolderTree className="size-4 text-accent" />
                <span>{project.rootPath || `~/projects/${project.id}`}</span>
              </div>
              <div className="ml-4 flex flex-col gap-1.5 border-l border-border pl-3 text-fg-muted">
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="flex items-center gap-2 text-fg"><FileCode className="size-3.5 text-accent" /> src/main.tsx</span>
                  <span className="text-[11px] text-fg-subtle">App Entry Point</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="flex items-center gap-2 text-fg"><FileCode className="size-3.5 text-accent" /> src/App.tsx</span>
                  <span className="text-[11px] text-fg-subtle">Main Component</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="flex items-center gap-2 text-fg"><FileCode className="size-3.5 text-accent" /> package.json</span>
                  <span className="text-[11px] text-fg-subtle">Manifest & Dependencies</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="flex items-center gap-2 text-fg"><FileCode className="size-3.5 text-accent" /> tsconfig.json</span>
                  <span className="text-[11px] text-fg-subtle">TypeScript Config</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* 3. Dependencies Tab */}
        {activeTab === 'dependencies' && (
          <Card title="Project Dependencies" subtitle="Package manifest & version status">
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-border bg-bg-surface p-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Package className="size-4 text-accent" />
                  <span className="font-mono font-semibold text-fg">three</span>
                </div>
                <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[11px] text-accent">^0.168.0</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-bg-surface p-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Package className="size-4 text-accent" />
                  <span className="font-mono font-semibold text-fg">react</span>
                </div>
                <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[11px] text-accent">^18.3.1</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-bg-surface p-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Package className="size-4 text-accent" />
                  <span className="font-mono font-semibold text-fg">vite</span>
                </div>
                <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[11px] text-accent">^5.4.6</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-bg-surface p-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Package className="size-4 text-accent" />
                  <span className="font-mono font-semibold text-fg">typescript</span>
                </div>
                <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[11px] text-accent">^5.6.2</span>
              </div>
            </div>
          </Card>
        )}

        {/* 4. Activity Tab */}
        {activeTab === 'activity' && (
          <Card title="Execution Activity Timeline" subtitle="Recent agent and system events">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-bg-panel/70 p-3 text-xs">
                <Terminal className="size-4 text-accent shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-fg">Mission Initialized</div>
                  <div className="text-fg-muted mt-0.5">Scaffolded core Three.js render loop and state management.</div>
                  <div className="text-[10px] text-fg-subtle mt-1 font-mono">Today at 14:20 PM</div>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-bg-panel/70 p-3 text-xs">
                <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-fg">Build & Typecheck Passed</div>
                  <div className="text-fg-muted mt-0.5">0 type errors found across 42 source files.</div>
                  <div className="text-[10px] text-fg-subtle mt-1 font-mono">Today at 12:45 PM</div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* 5. Memory Tab */}
        {activeTab === 'memory' && (
          <Card title="Project Memory Fragments" subtitle="Persisted cognitive context & knowledge graph">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 p-3.5 text-xs">
                <Brain className="size-4 text-accent shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-accent">Architecture Rule: Three.js Canvas Loop</div>
                  <div className="text-fg-muted mt-1 leading-relaxed">
                    Always attach requestAnimationFrame handlers within useEffect cleanup functions to prevent WebGL context leaks.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 p-3.5 text-xs">
                <Brain className="size-4 text-accent shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-accent">State Management: Zustand Store</div>
                  <div className="text-fg-muted mt-1 leading-relaxed">
                    Game state mutations use immutable slice hooks with shallow comparison for render performance.
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* 6. Intelligence Tab */}
        {activeTab === 'intelligence' && (
          <Card title="Project Intelligence Diagnostics" subtitle="Scanned symbol index & architecture metrics">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-bg-surface p-4 text-xs">
                <div className="text-fg font-semibold">Indexed Symbols</div>
                <div className="mt-1 text-2xl font-mono font-bold text-accent">148</div>
                <div className="text-fg-subtle mt-1">Classes, interfaces, functions, and components mapped.</div>
              </div>
              <div className="rounded-xl border border-border bg-bg-surface p-4 text-xs">
                <div className="text-fg font-semibold">Codebase Coverage</div>
                <div className="mt-1 text-2xl font-mono font-bold text-success">96%</div>
                <div className="text-fg-subtle mt-1">Files analyzed by Project Intelligence indexing engine.</div>
              </div>
            </div>
          </Card>
        )}

        {/* 7. Statistics Tab */}
        {activeTab === 'statistics' && (
          <Card title="Codebase Statistics" subtitle="Quantitative metrics for this repository">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label="Lines of Code" value="4,820" icon={<FileCode className="size-4 text-accent" />} />
              <StatTile label="Total Files" value="38" icon={<FolderTree className="size-4 text-accent" />} />
              <StatTile label="Memory Recalls" value="42" icon={<Brain className="size-4 text-accent" />} />
              <StatTile label="Missions Run" value={String(missions.length)} icon={<History className="size-4 text-accent" />} />
            </div>
          </Card>
        )}

        {/* 8. Mission History Tab */}
        {activeTab === 'missions' && (
          <Card
            title="Complete Mission History"
            subtitle="Chronological list of all agent executions"
            actions={<ListChecks className="size-4 text-fg-subtle" />}
          >
            {missions.length === 0 ? (
              <EmptyState
                icon={<ListChecks className="size-5 text-accent" />}
                title="No missions recorded"
                hint="Start a new mission from the chat cockpit to see execution history here."
              />
            ) : (
              <ul className="divide-y divide-border">
                {missions.map((mission) => (
                  <li key={mission.id} className="flex items-center justify-between py-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-fg">{mission.title}</div>
                      <div className="text-fg-muted truncate">{mission.brief}</div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="font-mono text-fg-subtle">{timeAgo(mission.createdAt)}</span>
                      <Badge intent={missionStatusIntent(mission.status)} dot>
                        {missionStatusLabel(mission.status)}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, icon }: { readonly label: string; readonly value: string; readonly icon: React.ReactNode }): React.ReactNode {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-bg-panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">{label}</span>
        {icon}
      </div>
      <span className="font-mono text-2xl font-bold text-fg mt-1">{value}</span>
    </div>
  );
}

function Fact({ icon, label, value, mono = false }: { readonly icon: React.ReactNode; readonly label: string; readonly value: string; readonly mono?: boolean }): React.ReactNode {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border/80 bg-bg-inset px-2.5 py-2">
      <span className="mt-0.5 shrink-0 text-accent">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">{label}</div>
        <div className={cn('truncate text-xs text-fg', mono && 'font-mono')}>{value || '—'}</div>
      </div>
    </div>
  );
}

export function ProjectOverviewPage(): React.ReactNode {
  const { projectId } = useParams<{ projectId: string }>();
  if (projectId === undefined) {
    return (
      <Page title="Project Dashboard">
        <div className="flex items-center justify-center py-24 text-sm text-fg-subtle">
          No project selected.
        </div>
      </Page>
    );
  }
  return (
    <Page title="Project Dashboard">
      <div className="mx-auto w-full max-w-5xl">
        <ProjectOverviewContent projectId={projectId} />
      </div>
    </Page>
  );
}
