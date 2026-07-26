import { createServiceToken } from '@gamedev-agent/di';
import type { StudioKernel } from '@gamedev-agent/kernel';
import type { StepExecutor } from './WorkflowDefinition';
import { WorkflowManager } from './WorkflowManager';

/**
 * DI token for the {@link WorkflowManager}. Resolving it yields the single,
 * kernel-scoped Workflow Engine instance. Registering twice throws a
 * `DuplicateServiceError` — the fail-fast behavior we want.
 */
export const WORKFLOW_MANAGER_TOKEN = createServiceToken<WorkflowManager>('nova.workflow-manager');

/**
 * Optional executor the Workflow Engine drives each step through. The engine is
 * executor-agnostic: it defines the `StepExecutor` contract but never implements
 * it, so the concrete performer (an Execution Engine, Role System, or — in the
 * Studio scope — a tool-invoking orchestrator) is injected via this token. When
 * absent, runs are created in `running` and advanced explicitly via
 * `succeedStep`/`failStep`.
 */
export const WORKFLOW_EXECUTOR_TOKEN = createServiceToken<StepExecutor>('nova.workflow-executor');

/**
 * A kernel module that installs the Nova Workflow Engine.
 *
 * Registering it during kernel boot makes `WORKFLOW_MANAGER_TOKEN` resolvable.
 * Construction is deferred to the `register` phase so the manager can pull the
 * shared Event Bus and Logger from the container. This is the *only* coupling
 * between the Workflow Engine and the Kernel, expressed through the public
 * `KernelModule` contract, so `workflow` still does not statically depend on
 * kernel internals.
 *
 * The Workflow Engine integrates with the Coordinator (to read approved Mission
 * state), the Capability framework (to gate steps on required capabilities), and
 * the Studio API (to surface workflow progress). Those wires are established by
 * the consuming application through the manager's options — this module wires
 * only the bus, logger, and a default (capability-aware) executor seam so the
 * engine boots in isolation. Future integration points (Planner, Router, Role
 * System, Execution Engine) plug in through the same options without changing
 * this module.
 */
export const workflowModule: {
  readonly name: string;
  register(kernel: StudioKernel): void;
} = {
  name: 'nova.workflow',
  register(kernel: StudioKernel): void {
    kernel.registerService({
      token: WORKFLOW_MANAGER_TOKEN,
      singleton: true,
      factory: async () => {
        const executor = kernel.services.has(WORKFLOW_EXECUTOR_TOKEN)
          ? await kernel.services.resolve<StepExecutor>(WORKFLOW_EXECUTOR_TOKEN)
          : undefined;
        return new WorkflowManager({
          eventBus: kernel.events,
          logger: kernel.logger.child('workflow'),
          ...(executor !== undefined ? { executor } : {}),
        });
      },
    });
  },
};
