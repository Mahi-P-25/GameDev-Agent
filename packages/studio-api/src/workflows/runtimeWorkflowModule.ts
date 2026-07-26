/**
 * Runtime Workflows — Kernel Module.
 * ===========================================================================
 *
 * Wires the Runtime Workflows into the Nova Kernel. It reaches into the
 * container only through public tokens:
 *
 *  - `RUNTIME_TOKEN`              → the Runtime (Git/Build/Test/Package/Terminal
 *                                    providers) the executor drives each step
 *                                    through. Composes existing infrastructure.
 *  - `WORKFLOW_MANAGER_TOKEN`     → the Workflow Engine (lifecycle, ordering,
 *                                    control signals, events).
 *  - `WORKFLOW_EXECUTOR_TOKEN`    → registers the {@link RuntimeWorkflowExecutor}
 *                                    (Runtime-invoking step performer).
 *  - `WORKFLOW_RUNNER_TOKEN`      → extends the {@link WorkflowRunner} facade so
 *                                    the Studio API can start Runtime Workflows.
 *
 * On `register` it also:
 *  - registers the eight Runtime Workflow templates with the engine;
 *  - attaches a Notification Center listener that raises `notification.raised`
 *    events when a Runtime Workflow completes or fails (truthful, derived from
 *    the engine's own `workflow.completed` / `workflow.failed` events).
 *
 * This reuses the existing KernelModule + DI + EventBus pattern; it introduces no
 * new architecture. The execution chain is exactly:
 *   Planner → Workflow → Runtime Providers → Events → Presence → Notification.
 */

import { createServiceToken } from '@gamedev-agent/di';
import { NotificationRaised } from '@gamedev-agent/events';
import type { StudioKernel } from '@gamedev-agent/kernel';
import { RUNTIME_TOKEN, type Runtime } from '@gamedev-agent/runtime';
import { WorkflowCompleted, WorkflowFailed } from '@gamedev-agent/workflow';
import type { WorkflowManager } from '@gamedev-agent/workflow';
import { WORKFLOW_MANAGER_TOKEN } from '@gamedev-agent/workflow';
import { RuntimeWorkflowExecutor } from './RuntimeWorkflowExecutor';
import { registerRuntimeWorkflowTemplates } from './RuntimeWorkflowTemplates';
import { WorkflowRunner } from './WorkflowRunner';
import { WORKFLOW_RUNNER_TOKEN } from './devWorkflowModule';

/** DI token for the Runtime Workflow executor (discoverability). */
export const RUNTIME_WORKFLOW_EXECUTOR_TOKEN = createServiceToken<RuntimeWorkflowExecutor>(
  'nova.runtime-workflow-executor',
);

export const runtimeWorkflowModule: {
  readonly name: string;
  register(kernel: StudioKernel): Promise<void>;
} = {
  name: 'nova.runtime-workflows',
  async register(kernel: StudioKernel): Promise<void> {
    if (!kernel.services.has(RUNTIME_TOKEN)) {
      // Runtime is optional in some boots (pure browser, no backend). Skip wiring
      // rather than fail-fast, so the rest of the studio still boots.
      return;
    }

    const runtime = await kernel.services.resolve<Runtime>(RUNTIME_TOKEN);
    const manager = await kernel.services.resolve<WorkflowManager>(WORKFLOW_MANAGER_TOKEN);

    // The Runtime-backed step performer. The engine auto-drives any run once the
    // executor is attached (it is constructed with no executor by workflowModule,
    // so we attach it here).
    const executor = new RuntimeWorkflowExecutor({
      runtime,
      workflow: manager,
      bus: kernel.events,
      logger: kernel.logger.child('runtime-workflow'),
    });
    manager.setExecutor(executor);
    kernel.registerService({
      token: RUNTIME_WORKFLOW_EXECUTOR_TOKEN,
      singleton: true,
      factory: () => executor,
    });

    // Register the eight Runtime Workflow templates with the engine.
    await registerRuntimeWorkflowTemplates((definition) => manager.register(definition));

    // Ensure the Workflow Runner facade exists. It is the same class the Studio
    // API consumes; registering it here keeps Runtime Workflows bootable even
    // when the Development Workflows module is absent. Idempotent.
    if (!kernel.services.has(WORKFLOW_RUNNER_TOKEN)) {
      kernel.registerService({
        token: WORKFLOW_RUNNER_TOKEN,
        singleton: true,
        factory: () => new WorkflowRunner(manager),
      });
    }

    // Notification Center feed: raise a notification when a Runtime Workflow
    // completes or fails. Pure consumer of the event pipeline — no new state.
    kernel.events.subscribe(WorkflowCompleted, (e) => {
      void kernel.events.publish(NotificationRaised, {
        title: 'Workflow completed',
        body: `Run ${e.payload.executionId} completed.`,
        kind: 'success',
        executionId: String(e.payload.executionId),
      });
    });
    kernel.events.subscribe(WorkflowFailed, (e) => {
      void kernel.events.publish(NotificationRaised, {
        title: 'Workflow failed',
        body: e.payload.reason ?? 'A workflow run failed.',
        kind: 'error',
        executionId: String(e.payload.executionId),
      });
    });
  },
};
