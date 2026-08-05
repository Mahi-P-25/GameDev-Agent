import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ConversationStoreProvider } from './services/ConversationStoreProvider';

const GoalsPage = lazy(() => import('./pages/GoalsPage').then((m) => ({ default: m.GoalsPage })));
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const InboxPage = lazy(() => import('./pages/InboxPage').then((m) => ({ default: m.InboxPage })));
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const MissionControlPage = lazy(() =>
  import('./pages/MissionControlPage').then((m) => ({ default: m.MissionControlPage })),
);
const MissionsPage = lazy(() => import('./pages/MissionsPage').then((m) => ({ default: m.MissionsPage })));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })));
const ProjectOverviewPage = lazy(() =>
  import('./pages/ProjectOverviewPage').then((m) => ({ default: m.ProjectOverviewPage })),
);
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const StudioTeamPage = lazy(() =>
  import('./pages/StudioTeamPage').then((m) => ({ default: m.StudioTeamPage })),
);
const WorkflowsPage = lazy(() =>
  import('./pages/WorkflowsPage').then((m) => ({ default: m.WorkflowsPage })),
);
const ProjectIntelligencePage = lazy(() =>
  import('./pages/ProjectIntelligencePage').then((m) => ({ default: m.ProjectIntelligencePage })),
);
const WorkspacePage = lazy(() => import('./pages/WorkspacePage').then((m) => ({ default: m.WorkspacePage })));

function RouteFallback(): React.ReactNode {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg-base text-fg-subtle">
      <span className="font-mono text-xs">Loading…</span>
    </div>
  );
}

/** Top-level route table for Nova Studio. Routes are lazy-loaded per page. */
export function AppRoutes(): React.ReactNode {
  return (
    <ConversationStoreProvider>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/mission-control" element={<MissionControlPage />} />
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectOverviewPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/missions" element={<MissionsPage />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/studio" element={<StudioTeamPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/intelligence" element={<ProjectIntelligencePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ConversationStoreProvider>
  );
}
