import { COORDINATOR_MANAGER_TOKEN } from '@gamedev-agent/coordinator';
import type { CoordinatorManager } from '@gamedev-agent/coordinator';
import { createServiceToken } from '@gamedev-agent/di';
import type { StudioKernel } from '@gamedev-agent/kernel';
import {
  TOOL_RUNTIME_TOKEN,
  VSCodeToolAdapter,
  vscodeDescriptor,
} from '@gamedev-agent/tool-runtime';
import type { ToolManager } from '@gamedev-agent/tool-runtime';
import { VSCodeClient } from './VSCodeClient';
import type { CoordinatorLink, VSCodeClientOptions } from './VSCodeTypes';

/**
 * DI token for the {@link VSCodeClient}. Resolving it yields the single,
 * kernel-scoped VS Code integration instance. Registering twice throws a
 * `DuplicateServiceError` — the fail-fast behavior we want.
 */
export const VSCODE_CLIENT_TOKEN = createServiceToken<VSCodeClient>('nova.vscode-client');

/**
 * A kernel module that installs the Nova VS Code integration.
 *
 * Registering it during kernel boot makes `VSCODE_CLIENT_TOKEN` resolvable from
 * the container. Construction is deferred to the `register` phase so the client
 * can pull the shared Event Bus and Logger from the container — both guaranteed
 * available by the `service-registry` stage in which `register` runs.
 *
 * The integration's only coupling to the rest of Nova is expressed through the
 * public Kernel Module contract and well-known tokens:
 *  - `kernel.events`                  → the shared Event Bus (it publishes
 *                                       workspace/file/watcher events here)
 *  - `COORDINATOR_MANAGER_TOKEN`      → resolved, when present, to build a
 *                                       narrow {@link CoordinatorLink} so file
 *                                       operations can be correlated to a Mission
 *
 * The dependency arrow stays acyclic and one-directional:
 * `vscode → (events, coordinator) → kernel`. The integration never imports
 * Studio API internals; it publishes events the Studio API already consumes, and
 * the Coordinator link is a read-only, capability-scoped seam.
 */
export const vscodeModule: {
  readonly name: string;
  register(kernel: StudioKernel): void | Promise<void>;
} = {
  name: 'nova.vscode',
  async register(kernel: StudioKernel): Promise<void> {
    const coordinator = kernel.services.has(COORDINATOR_MANAGER_TOKEN)
      ? await kernel.services.resolve<CoordinatorManager>(COORDINATOR_MANAGER_TOKEN)
      : undefined;

    const link: CoordinatorLink | undefined = coordinator
      ? {
          resolveMission(correlationId) {
            const mission = coordinator.find(correlationId as never);
            return mission === undefined ? null : { missionId: String(mission.id) };
          },
        }
      : undefined;

    const options: VSCodeClientOptions = {
      eventBus: kernel.events,
      logger: kernel.logger.child('vscode'),
      ...(link !== undefined ? { coordinator: link } : {}),
    };

    kernel.registerService({
      token: VSCODE_CLIENT_TOKEN,
      singleton: true,
      factory: () => new VSCodeClient(options),
    });

    // Register VS Code as a Tool Runtime tool when the runtime is present, so the
    // Studio API, Coordinator, and Capability framework can discover and invoke
    // it (e.g. Development Workflows that open or inspect a workspace).
    if (kernel.services.has(TOOL_RUNTIME_TOKEN)) {
      const manager = await kernel.services.resolve<ToolManager>(TOOL_RUNTIME_TOKEN);
      const client = await kernel.services.resolve<VSCodeClient>(VSCODE_CLIENT_TOKEN);
      await manager.register(vscodeDescriptor, new VSCodeToolAdapter(client));
      await manager.connect(vscodeDescriptor.id, { kind: 'director' });
    }
  },
};
