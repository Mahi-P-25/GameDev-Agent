import { createServiceToken } from '@gamedev-agent/di';
import type { StudioKernel } from '@gamedev-agent/kernel';
import { ProjectManager } from './ProjectManager';

/**
 * DI token for the {@link ProjectManager}. Resolving it yields the single,
 * kernel-scoped Project System instance. Registering twice (e.g. two modules
 * both calling `registerProjectModule`) throws a `DuplicateServiceError`, which
 * is exactly the fail-fast behavior we want.
 */
export const PROJECT_MANAGER_TOKEN = createServiceToken<ProjectManager>('nova.project-manager');

/**
 * A kernel module that installs the Nova Project System.
 *
 * Registering this module during kernel boot makes `PROJECT_MANAGER_TOKEN`
 * resolvable from the container. Construction is deferred to the `register`
 * phase so the manager can pull the shared Event Bus and Logger from the
 * container — both of which are guaranteed available by the `service-registry`
 * stage (the stage in which `register` runs).
 *
 * This is the *only* coupling between the Project System and the Kernel; it is
 * expressed through the public `KernelModule` contract, so `project` still does
 * not statically depend on kernel internals.
 */
export const projectModule: {
  readonly name: string;
  register(kernel: StudioKernel): void;
} = {
  name: 'nova.project',
  register(kernel: StudioKernel): void {
    kernel.registerService({
      token: PROJECT_MANAGER_TOKEN,
      singleton: true,
      factory: () => {
        const manager = new ProjectManager({
          eventBus: kernel.events,
          logger: kernel.logger.child('project'),
        });
        return manager;
      },
    });
  },
};
