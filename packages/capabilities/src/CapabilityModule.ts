import { createServiceToken } from '@gamedev-agent/di';
import type { StudioKernel } from '@gamedev-agent/kernel';
import { CapabilityManager } from './CapabilityManager';

/**
 * DI token for the {@link CapabilityManager}. Resolving it yields the single,
 * kernel-scoped Capability Manager. Registering twice throws a
 * `DuplicateServiceError` — the fail-fast behavior we want.
 */
export const CAPABILITY_MANAGER_TOKEN =
  createServiceToken<CapabilityManager>('nova.capability-manager');

/**
 * A kernel module that installs the Nova Capability Framework.
 *
 * Registering it during kernel boot makes `CAPABILITY_MANAGER_TOKEN` resolvable.
 * Construction is deferred to the `register` phase so the manager can pull the
 * shared Event Bus and Logger from the container. This is the *only* coupling
 * between the Capability Framework and the Kernel, expressed through the public
 * `KernelModule` contract, so `capabilities` does not statically depend on
 * kernel internals.
 */
export const capabilityModule: {
  readonly name: string;
  register(kernel: StudioKernel): void;
} = {
  name: 'nova.capabilities',
  register(kernel: StudioKernel): void {
    kernel.registerService({
      token: CAPABILITY_MANAGER_TOKEN,
      singleton: true,
      factory: () => {
        return new CapabilityManager({
          eventBus: kernel.events,
          logger: kernel.logger.child('capabilities'),
        });
      },
    });
  },
};
