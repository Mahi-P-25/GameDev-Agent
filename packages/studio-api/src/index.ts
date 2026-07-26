/**
 * Studio API — Public Surface
 * ===========================================================================
 *
 * This is the **only** file a Nova frontend (Desktop, Web, CLI, VS Code) should
 * import from `@gamedev-agent/studio-api`. Everything else in this package is
 * an implementation detail behind the façade boundary.
 *
 * What you get:
 *  - {@link StudioApi}        — the application façade (orchestrates the kernel).
 *  - {@link STUDIO_API_TOKEN} — DI token to resolve the façade from the kernel.
 *  - {@link studioModule}     — the Kernel module that installs the façade.
 *  - {@link getStudioHome}    — the single Studio Home aggregate the UI renders.
 *  - {@link StudioOrchestrator}, {@link studioOrchestratorModule}
 *                              — the event-driven glue that auto-runs the slice.
 *  - Contracts (`./StudioApiContracts`) — the stable DTOs every UI depends on.
 *  - Errors (`./StudioApiErrors`)       — the stable error family to catch.
 */

export { StudioApi, STUDIO_API_TOKEN } from './StudioApi';
export type { StudioApiOptions } from './StudioApi';
export { studioModule } from './StudioModule';

export {
  StudioOrchestrator,
  STUDIO_ORCHESTRATOR_TOKEN,
  studioOrchestratorModule,
} from './StudioOrchestrator';
export { buildStudioHome } from './StudioHome';
export type { StudioHome } from './StudioApiContracts';

// Development Workflows — orchestration layer built on the Workflow Engine.
export { WorkflowRunner } from './workflows/WorkflowRunner';
export { devWorkflowModule, WORKFLOW_RUNNER_TOKEN } from './workflows/devWorkflowModule';
export {
  DEV_WORKFLOW_TEMPLATES,
  registerDevWorkflowTemplates,
} from './workflows/WorkflowTemplates';
export {
  DEV_WORKFLOW_IDS,
  DEV_WORKFLOW_STEP_KEY,
} from './workflows/DevelopmentWorkflow';
export type {
  DevelopmentWorkflowKind,
  DevelopmentWorkflowTool,
  DevelopmentWorkflowStepSpec,
  DevelopmentWorkflowInputSpec,
  StartDevelopmentWorkflowRequest,
} from './workflows/DevelopmentWorkflow';

// Runtime Workflows — orchestration layer built on the Runtime providers.
export {
  runtimeWorkflowModule,
  RUNTIME_WORKFLOW_EXECUTOR_TOKEN,
} from './workflows/runtimeWorkflowModule';
export {
  RUNTIME_WORKFLOW_TEMPLATES,
  registerRuntimeWorkflowTemplates,
} from './workflows/RuntimeWorkflowTemplates';
export {
  RUNTIME_WORKFLOW_IDS,
  RUNTIME_WORKFLOW_STEP_KEY,
} from './workflows/RuntimeWorkflow';
export type {
  RuntimeWorkflowKind,
  RuntimeWorkflowStepSpec,
  RuntimeWorkflowInputSpec,
  RuntimeAction,
  StartRuntimeWorkflowRequest,
} from './workflows/RuntimeWorkflow';
export { RuntimeWorkflowExecutor } from './workflows/RuntimeWorkflowExecutor';

export type {
  StudioWorkspace,
  StudioGoal,
  StudioGoalStatus,
  StudioPlannerStatus,
  StudioWorkflowStatus,
  StudioExecutionPhase,
  StudioProjectSummary,
  StudioProject,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateMissionRequest,
  StudioMission,
  StudioRoleRequirement,
  StudioCapability,
  StudioHealth,
  StudioDependencyHealth,
  StudioActivity,
  StudioCoordinatorStatus,
  StudioWorkflowKind,
  StudioWorkflowTemplate,
  StudioWorkflowRunState,
  StudioWorkflowStep,
  StudioWorkflowRun,
  StartWorkflowRequest,
  StudioContext,
} from './StudioApiContracts';

export {
  StudioApiError,
  StudioNotFoundError,
  StudioRejectionError,
  StudioNotReadyError,
  StudioDependencyError,
} from './StudioApiErrors';
