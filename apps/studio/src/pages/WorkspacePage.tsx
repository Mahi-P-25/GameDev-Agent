import { useStudioData } from '../studio/StudioDataProvider';
import { WorkspaceLayout } from '../components/workspace/WorkspaceLayout';

/**
 * WorkspacePage — Autonomous AI-Native IDE featuring VS Code style File Explorer,
 * Monaco Code Editor with syntax highlighting and tabs, Project Header, and Inspector Panel.
 */
export function WorkspacePage(): React.ReactNode {
  const { api } = useStudioData();
  const workspace = api.getWorkspace();

  return (
    <WorkspaceLayout
      projectName={workspace.projectCount > 0 ? 'Nova Autonomous Workspace' : 'Nova Game Workspace'}
      rootPath="~/Documents/GameDev-Agent"
    />
  );
}
