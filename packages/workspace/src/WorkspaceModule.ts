import { createServiceToken } from '@gamedev-agent/di';
import type { StudioKernel } from '@gamedev-agent/kernel';
import { PROJECT_MANAGER_TOKEN } from '@gamedev-agent/project';
import type { ProjectManager } from '@gamedev-agent/project';
import { WorkspaceManager } from './WorkspaceManager';

/**
 * DI token for the {@link WorkspaceManager}. Resolving it yields the single,
 * kernel-scoped Workspace System instance. Registering twice (e.g. two modules
 * both calling `registerWorkspaceModule`) throws a `DuplicateServiceError`, which
 * is exactly the fail-fast behavior we want.
 */
export const WORKSPACE_MANAGER_TOKEN = createServiceToken<WorkspaceManager>('nova.workspace-manager');

/**
 * A kernel module that installs the Nova Workspace System.
 *
 * Registering this module during kernel boot makes `WORKSPACE_MANAGER_TOKEN`
 * resolvable from the container. Construction is deferred to the `register` phase
 * so the manager can pull the shared Event Bus and Logger from the container —
 * both of which are guaranteed available by the `service-registry` stage (the
 * stage in which `register` runs).
 *
 * The Workspace System also wires itself to the Project System: when the kernel
 * has registered `PROJECT_MANAGER_TOKEN`, the manager is given a `projectExists`
 * guard so it can validate project references at ownership time (a Workspace may
 * only own Projects that actually exist). The coupling is expressed entirely
 * through public tokens — `workspace` never imports project internals, keeping
 * the dependency arrow acyclic (`workspace → project → kernel`).
 *
 * This is the *only* coupling between the Workspace System and the Kernel; it is
 * expressed through the public `KernelModule` contract, so `workspace` still
 * does not statically depend on kernel internals.
 */
export const workspaceModule: {
  readonly name: string;
  register(kernel: StudioKernel): void | Promise<void>;
} = {
  name: 'nova.workspace',
  async register(kernel: StudioKernel): Promise<void> {
    const projects = kernel.services.has(PROJECT_MANAGER_TOKEN)
      ? await kernel.services.resolve<ProjectManager>(PROJECT_MANAGER_TOKEN)
      : undefined;

    kernel.registerService({
      token: WORKSPACE_MANAGER_TOKEN,
      singleton: true,
      factory: () => {
        const manager = new WorkspaceManager({
          eventBus: kernel.events,
          logger: kernel.logger.child('workspace'),
          // A synchronous predicate: the project manager is already resolved by
          // the time the workspace manager is constructed, so ownership checks
          // never await.
          projectExists: projects === undefined ? undefined : (id) => projects.find(id) !== undefined,
        });
        return manager;
      },
    });
  },
};
