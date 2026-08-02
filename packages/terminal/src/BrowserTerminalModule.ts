import { CAPABILITY_MANAGER_TOKEN } from '@gamedev-agent/capabilities';
import type { CapabilityManager } from '@gamedev-agent/capabilities';
import { COORDINATOR_MANAGER_TOKEN } from '@gamedev-agent/coordinator';
import type { CoordinatorManager } from '@gamedev-agent/coordinator';
import { createServiceToken } from '@gamedev-agent/di';
import type { StudioKernel } from '@gamedev-agent/kernel';
import { TOOL_RUNTIME_TOKEN } from '@gamedev-agent/tool-runtime';
import type { ToolManager } from '@gamedev-agent/tool-runtime';
import { TerminalClient } from './TerminalClient';
import { TerminalToolAdapter, terminalDescriptor } from './TerminalToolAdapter';
import type { CoordinatorLink, TerminalProcessRunner } from './TerminalTypes';

/**
 * DI token for the browser-safe {@link TerminalClient}.
 */
export const TERMINAL_CLIENT_TOKEN = createServiceToken<TerminalClient>('nova.terminal-client');

/**
 * The **browser-safe** Terminal kernel module.
 *
 * This is the module the Studio React application boots. It imports NO Node.js
 * APIs — no `node:child_process`, no `process`, no `fs`, no `path`, no `os`.
 * Actual process execution is the responsibility of the Node/Runtime backend
 * layer (`nodeTerminalModule`); the browser only wires the Terminal Tool's
 * audited façade and, if a real runner is injected by the host, lets it run.
 *
 * By default the browser runner refuses to spawn processes (terminal execution
 * belongs in the backend) so the UI can never trigger `child_process` from a
 * React component or browser module. The Studio UI talks to the terminal only
 * through the Studio API façade, satisfying Nova's architecture.
 */
import { RuntimeBridgeRunner } from './RuntimeBridgeClient';

export const browserTerminalModule: {
  readonly name: string;
  register(kernel: StudioKernel): void | Promise<void>;
} = {
  name: 'nova.terminal.browser',
  async register(kernel: StudioKernel): Promise<void> {
    const coordinatorManager = kernel.services.has(COORDINATOR_MANAGER_TOKEN)
      ? await kernel.services.resolve<CoordinatorManager>(COORDINATOR_MANAGER_TOKEN)
      : undefined;

    const link: CoordinatorLink | undefined = coordinatorManager
      ? {
          resolveMission(correlationId) {
            const mission = coordinatorManager.find(correlationId as never);
            return mission === undefined ? null : { missionId: String(mission.id) };
          },
        }
      : undefined;

    const options = {
      eventBus: kernel.events,
      logger: kernel.logger.child('terminal'),
      runner: browserRunner(),
      ...(link !== undefined ? { coordinator: link } : {}),
    };

    kernel.registerService({
      token: TERMINAL_CLIENT_TOKEN,
      singleton: true,
      factory: () => new TerminalClient(options),
    });

    // Register the terminal as a Tool Runtime tool when the runtime is present.
    if (kernel.services.has(TOOL_RUNTIME_TOKEN)) {
      const manager = await kernel.services.resolve<ToolManager>(TOOL_RUNTIME_TOKEN);
      const client = await kernel.services.resolve<TerminalClient>(TERMINAL_CLIENT_TOKEN);
      const capabilityManager = kernel.services.has(CAPABILITY_MANAGER_TOKEN)
        ? await kernel.services.resolve<CapabilityManager>(CAPABILITY_MANAGER_TOKEN)
        : undefined;
      void capabilityManager;
      await manager.register(terminalDescriptor, new TerminalToolAdapter(client));
      await manager.connect(terminalDescriptor.id, { kind: 'director' });
    }
  },
};

/**
 * Browser process runner backed by the Nova Local Runtime Bridge.
 * Connects over WebSocket IPC or virtual process execution runner.
 */
function browserRunner(): TerminalProcessRunner {
  return new RuntimeBridgeRunner();
}
