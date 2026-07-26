import { createServiceToken } from '@gamedev-agent/di';
import type { StudioKernel } from '@gamedev-agent/kernel';
import { CoordinatorManager } from './CoordinatorManager';

/**
 * DI token for the {@link CoordinatorManager}. Resolving it yields the single,
 * kernel-scoped Coordinator instance. Registering twice throws a
 * `DuplicateServiceError` — the fail-fast behavior we want.
 */
export const COORDINATOR_MANAGER_TOKEN = createServiceToken<CoordinatorManager>(
  'nova.coordinator-manager',
);

/**
 * A kernel module that installs the Nova Studio Coordinator.
 *
 * Registering it during kernel boot makes `COORDINATOR_MANAGER_TOKEN` resolvable.
 * Construction is deferred to the `register` phase so the manager can pull the
 * shared Event Bus and Logger from the container. This is the *only* coupling
 * between the Coordinator and the Kernel, expressed through the public
 * `KernelModule` contract, so `coordinator` still does not statically depend on
 * kernel internals.
 */
export const coordinatorModule: {
  readonly name: string;
  register(kernel: StudioKernel): void;
} = {
  name: 'nova.coordinator',
  register(kernel: StudioKernel): void {
    kernel.registerService({
      token: COORDINATOR_MANAGER_TOKEN,
      singleton: true,
      factory: () => {
        return new CoordinatorManager({
          eventBus: kernel.events,
          logger: kernel.logger.child('coordinator'),
        });
      },
    });
  },
};
