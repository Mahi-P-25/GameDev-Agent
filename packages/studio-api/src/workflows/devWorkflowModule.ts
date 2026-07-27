/**
 * Development Workflows — Kernel Module.
 * ===========================================================================
 *
 * Wires the Development Workflows into the Nova Kernel. It is the *only* place
 * this package reaches into the container for the pieces the workflows need, and
 * it reaches only through public tokens:
 *
 *  - `WORKFLOW_MANAGER_TOKEN`     → the Workflow Engine (already built with the
 *                                    executor below, via `WORKFLOW_EXECUTOR_TOKEN`).
 *  - `WORKFLOW_EXECUTOR_TOKEN`    → registers the {@link DevelopmentWorkflowExecutor}
 *                                    (tool-invoking step performer).
 *  - `TOOL_RUNTIME_TOKEN`         → the tools the executor drives (VS Code, Terminal).
 *  - `PROJECT_MANAGER_TOKEN`      → resolves the project root path per run.
 *  - `WORKFLOW_RUNNER_TOKEN`      → registers the {@link WorkflowRunner} facade the
 *                                    Studio API exposes to the UI.
 *
 * On `register` it also registers the three Development Workflow templates with
 * the Workflow Engine so they are available immediately at boot. This reuses the
 * existing KernelModule + DI + EventBus pattern; it introduces no new
 * architecture.
 */

import { COORDINATOR_MANAGER_TOKEN } from '@gamedev-agent/coordinator';
import { createServiceToken } from '@gamedev-agent/di';
import type { StudioKernel } from '@gamedev-agent/kernel';
import type { ProjectManager } from '@gamedev-agent/project';
import { PROJECT_MANAGER_TOKEN } from '@gamedev-agent/project';
import type { ToolManager } from '@gamedev-agent/tool-runtime';
import { TOOL_RUNTIME_TOKEN } from '@gamedev-agent/tool-runtime';
import type { WorkflowManager } from '@gamedev-agent/workflow';
import { WORKFLOW_EXECUTOR_TOKEN, WORKFLOW_MANAGER_TOKEN } from '@gamedev-agent/workflow';
import { DevelopmentWorkflowExecutor } from './DevelopmentWorkflowExecutor';
import { WorkflowRunner } from './WorkflowRunner';
import { registerDevWorkflowTemplates } from './WorkflowTemplates';

/** DI token for the {@link WorkflowRunner} facade. */
export const WORKFLOW_RUNNER_TOKEN = createServiceToken<WorkflowRunner>('nova.workflow-runner');

export const devWorkflowModule: {
  readonly name: string;
  register(kernel: StudioKernel): Promise<void>;
} = {
  name: 'nova.dev-workflows',
  async register(kernel: StudioKernel): Promise<void> {
    const manager = await kernel.services.resolve<WorkflowManager>(WORKFLOW_MANAGER_TOKEN);
    const projectManager = await kernel.services.resolve<ProjectManager>(PROJECT_MANAGER_TOKEN);

    // Register the step executor (tool-invoking performer) for the Workflow Engine.
    // Only register when no executor token exists yet (e.g. when the
    // Execution Engine module is absent). When a dedicated AI-execution module
    // provides WORKFLOW_EXECUTOR_TOKEN, prefer it over the deterministic
    // tool-invoking performer.
    if (kernel.services.has(TOOL_RUNTIME_TOKEN) && !kernel.services.has(WORKFLOW_EXECUTOR_TOKEN)) {
      const toolManager = await kernel.services.resolve<ToolManager>(TOOL_RUNTIME_TOKEN);
      const executor = new DevelopmentWorkflowExecutor(toolManager, projectManager);
      manager.setExecutor(executor);
      kernel.registerService({
        token: WORKFLOW_EXECUTOR_TOKEN,
        singleton: true,
        factory: () => executor,
      });
    }

    // Register the three Development Workflow templates with the engine.
    await registerDevWorkflowTemplates((definition) => manager.register(definition));

    // Register the runner facade the Studio API consumes.
    kernel.registerService({
      token: WORKFLOW_RUNNER_TOKEN,
      singleton: true,
      factory: () => new WorkflowRunner(manager),
    });

    // Touch the coordinator token so a missing coordinator fails fast at boot
    // rather than at first tool invocation (the tools use it for correlation).
    if (kernel.services.has(COORDINATOR_MANAGER_TOKEN)) {
      await kernel.services.resolve(COORDINATOR_MANAGER_TOKEN);
    }
  },
};
