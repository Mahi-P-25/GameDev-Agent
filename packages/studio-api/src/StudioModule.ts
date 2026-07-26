import { CAPABILITY_MANAGER_TOKEN } from '@gamedev-agent/capabilities';
import { CONTEXT_MANAGER_TOKEN, contextModule } from '@gamedev-agent/context';
import { COORDINATOR_MANAGER_TOKEN } from '@gamedev-agent/coordinator';
import type { KernelModule, StudioKernel } from '@gamedev-agent/kernel';
import { PLANNER_MANAGER_TOKEN } from '@gamedev-agent/planner';
import { PRODUCER_MANAGER_TOKEN } from '@gamedev-agent/producer';
import { PROJECT_MANAGER_TOKEN } from '@gamedev-agent/project';
import { WORKFLOW_MANAGER_TOKEN } from '@gamedev-agent/workflow';
import { STUDIO_API_TOKEN, StudioApi } from './StudioApi';
import { studioOrchestratorModule } from './StudioOrchestrator';
import { WORKFLOW_RUNNER_TOKEN } from './workflows/devWorkflowModule';
import { devWorkflowModule } from './workflows/devWorkflowModule';
import { runtimeWorkflowModule } from './workflows/runtimeWorkflowModule';

/**
 * Studio API — Kernel Module
 * ===========================================================================
 *
 * The single knot that ties the Studio API façade to the Nova Kernel. It is the
 * *only* place this package reaches into the container, and it reaches only
 * through public tokens:
 *
 *  - {@link COORDINATOR_MANAGER_TOKEN}   → the Coordinator facade
 *  - {@link PROJECT_MANAGER_TOKEN}       → the Project subsystem
 *  - {@link CAPABILITY_MANAGER_TOKEN}    → the Capability framework
 *  - {@link PRODUCER_MANAGER_TOKEN}      → the Producer (Goals)
 *  - {@link PLANNER_MANAGER_TOKEN}       → the Planner (Plans)
 *  - {@link WORKFLOW_MANAGER_TOKEN}      → the Workflow Engine (Execution)
 *  - `kernel.events`                     → the shared Event Bus
 *
 * It also installs {@link studioOrchestratorModule}, which auto-drives the
 * Goal → Plan → Workflow → Mission slice over the bus. Frontends never import
 * this module. The Kernel wires it during boot; the façade it produces
 * (`STUDIO_API_TOKEN`) is what every UI consumes. This keeps the dependency
 * direction correct: subsystems ⇢ kernel ⇢ studio-api ⇢ UI.
 */
export const studioModule: KernelModule = {
  name: 'nova.studio-api',
  async register(kernel: StudioKernel): Promise<void> {
    // Register the subsystems that contribute their own tokens (the orchestrator
    // and the Development Workflows runner) *before* we resolve everything, so
    // their tokens exist when we read them below. This module runs in the
    // `service-registry` stage alongside the others, so ordering within this
    // hook is what guarantees availability.
    if (studioOrchestratorModule.register !== undefined) {
      await studioOrchestratorModule.register(kernel);
    }
    if (devWorkflowModule.register !== undefined) {
      await devWorkflowModule.register(kernel);
    }
    if (runtimeWorkflowModule.register !== undefined) {
      await runtimeWorkflowModule.register(kernel);
    }
    if (contextModule.register !== undefined) {
      await contextModule.register(kernel);
    }

    const [
      coordinator,
      projects,
      capabilities,
      producer,
      planner,
      workflow,
      workflowRunner,
      context,
    ] = await Promise.all([
      kernel.services.resolve(COORDINATOR_MANAGER_TOKEN),
      kernel.services.resolve(PROJECT_MANAGER_TOKEN),
      kernel.services.resolve(CAPABILITY_MANAGER_TOKEN),
      kernel.services.resolve(PRODUCER_MANAGER_TOKEN),
      kernel.services.resolve(PLANNER_MANAGER_TOKEN),
      kernel.services.resolve(WORKFLOW_MANAGER_TOKEN),
      kernel.services.resolve(WORKFLOW_RUNNER_TOKEN),
      kernel.services.resolve(CONTEXT_MANAGER_TOKEN),
    ]);
    kernel.registerService({
      token: STUDIO_API_TOKEN,
      singleton: true,
      factory: () =>
        new StudioApi({
          coordinator,
          projects,
          capabilities,
          producer,
          planner,
          workflow,
          workflowRunner,
          context,
          bus: kernel.events,
        }),
    });
  },
};
