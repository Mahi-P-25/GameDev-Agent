import { Navigate, Route, Routes } from 'react-router-dom';
import { GoalsPage } from './pages/GoalsPage';
import { HomePage } from './pages/HomePage';
import { InboxPage } from './pages/InboxPage';
import { LandingPage } from './pages/LandingPage';
import { MissionControlPage } from './pages/MissionControlPage';
import { MissionsPage } from './pages/MissionsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { SettingsPage } from './pages/SettingsPage';
import { StudioTeamPage } from './pages/StudioTeamPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { ProjectIntelligencePage } from './pages/ProjectIntelligencePage';
import { WorkspacePage } from './pages/WorkspacePage';

/** Top-level route table for Nova Studio. */
export function AppRoutes(): React.ReactNode {
  return (
    <Routes>
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/" element={<HomePage />} />
      <Route path="/mission-control" element={<MissionControlPage />} />
      <Route path="/workspace" element={<WorkspacePage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/goals" element={<GoalsPage />} />
      <Route path="/missions" element={<MissionsPage />} />
      <Route path="/workflows" element={<WorkflowsPage />} />
      <Route path="/studio" element={<StudioTeamPage />} />
      <Route path="/inbox" element={<InboxPage />} />
      <Route path="/intelligence" element={<ProjectIntelligencePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
