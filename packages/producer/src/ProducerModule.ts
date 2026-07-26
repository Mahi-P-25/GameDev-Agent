import { createServiceToken } from '@gamedev-agent/di';
import type { StudioKernel } from '@gamedev-agent/kernel';
import { ProducerManager } from './ProducerManager';

/**
 * DI token for the {@link ProducerManager}. Resolving it yields the single,
 * kernel-scoped Producer instance. Registering twice throws a
 * `DuplicateServiceError` — the fail-fast behavior we want.
 */
export const PRODUCER_MANAGER_TOKEN = createServiceToken<ProducerManager>('nova.producer-manager');

/**
 * A kernel module that installs the Nova Producer.
 *
 * Registering it during kernel boot makes `PRODUCER_MANAGER_TOKEN` resolvable.
 * Construction is deferred to the `register` phase so the manager can pull the
 * shared Event Bus and Logger from the container. This is the *only* coupling
 * between the Producer and the Kernel, expressed through the public
 * `KernelModule` contract, so `producer` still does not statically depend on
 * kernel internals — nor on the Coordinator it feeds through events.
 */
export const producerModule: {
  readonly name: string;
  register(kernel: StudioKernel): void;
} = {
  name: 'nova.producer',
  register(kernel: StudioKernel): void {
    kernel.registerService({
      token: PRODUCER_MANAGER_TOKEN,
      singleton: true,
      factory: () => {
        return new ProducerManager({
          eventBus: kernel.events,
          logger: kernel.logger.child('producer'),
        });
      },
    });
  },
};
