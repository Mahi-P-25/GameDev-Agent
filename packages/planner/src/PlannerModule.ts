import { createServiceToken } from '@gamedev-agent/di';
import type { StudioKernel } from '@gamedev-agent/kernel';
import { PlannerManager } from './PlannerManager';

/**
 * DI token for the {@link PlannerManager}. Resolving it yields the single,
 * kernel-scoped Planning Engine instance. Registering twice throws a
 * `DuplicateServiceError` — the fail-fast behavior we want.
 */
export const PLANNER_MANAGER_TOKEN = createServiceToken<PlannerManager>('nova.planner-manager');

/**
 * A kernel module that installs the Nova Planning Engine.
 *
 * Registering it during kernel boot makes `PLANNER_MANAGER_TOKEN` resolvable.
 * Construction is deferred to the `register` phase so the manager can pull the
 * shared Event Bus and Logger from the container. This is the *only* coupling
 * between the Planner and the Kernel, expressed through the public `KernelModule`
 * contract, so `planner` still does not statically depend on kernel internals.
 *
 * The Planner integrates with the Producer (to receive approved Mission Trees),
 * the Coordinator (to tie plans to Missions), the Workflow Engine (which consumes
 * the immutable plan via `toWorkflowSource`), and the Studio API (to surface
 * plans). Those wires are established by the consuming application through the
 * manager's options — this module wires only the bus, logger, and the built-in
 * strategies so the engine boots in isolation. Future integration points (Memory,
 * Knowledge, Model Router, Role System, Execution Engine) plug in through the same
 * options without changing this module.
 */
export const plannerModule: {
  readonly name: string;
  register(kernel: StudioKernel): void;
} = {
  name: 'nova.planner',
  register(kernel: StudioKernel): void {
    kernel.registerService({
      token: PLANNER_MANAGER_TOKEN,
      singleton: true,
      factory: () => {
        return new PlannerManager({
          eventBus: kernel.events,
          logger: kernel.logger.child('planner'),
        });
      },
    });
  },
};
