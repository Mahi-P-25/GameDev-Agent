import type { ChildProcess } from 'node:child_process';
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
 * DI token for the {@link TerminalClient}. Resolving it yields the single,
 * kernel-scoped Terminal Tool instance. Registering twice throws a
 * `DuplicateServiceError` — the fail-fast behavior we want.
 */
export const TERMINAL_CLIENT_TOKEN = createServiceToken<TerminalClient>('nova.terminal-client');

/**
 * The **backend / Runtime** Terminal kernel module.
 *
 * This module is intended to run in a Node host (the Nova Runtime or backend
 * server), NOT in a browser. It installs the real process backend —
 * a thin {@link TerminalProcessRunner} over `node:child_process.spawn` — so the
 * Terminal Tool can actually execute commands. Importing this module pulls in
 * `node:child_process`; that is why browser/Studio code must never import it.
 *
 * Registration defers to the `register` phase so the client can pull the shared
 * Event Bus and Logger, plus the optional Coordinator seam. The terminal only
 * couples to the rest of Nova through the public Kernel Module contract and
 * well-known tokens:
 *  - `kernel.events`                  → the shared Event Bus (publishes `terminal.*`).
 *  - `COORDINATOR_MANAGER_TOKEN`      → resolved, when present, for a narrow link.
 *  - `TOOL_RUNTIME_TOKEN`             → resolved, when present, to register as a tool.
 *
 * The dependency arrow stays acyclic and one-directional:
 * `terminal → (events, coordinator, tool-runtime) → kernel`.
 */
export const nodeTerminalModule: {
  readonly name: string;
  register(kernel: StudioKernel): void | Promise<void>;
} = {
  name: 'nova.terminal.node',
  async register(kernel: StudioKernel): Promise<void> {
    // Browser code reaches this module, so surface a clear error rather than
    // silently importing `node:child_process` into the bundle.
    if (typeof process === 'undefined' || typeof process.versions?.node !== 'string') {
      throw new Error(
        '[nova.terminal] nodeTerminalModule requires a Node.js host; the browser must use browserTerminalModule instead.',
      );
    }

    const { spawn } = await import('node:child_process');
    const { NodeProcessBridge } = await import('./NodeProcessBridge');

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
      runner: nodeRunner(spawn, NodeProcessBridge),
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
 * The real process backend: a thin {@link TerminalProcessRunner} over
 * `node:child_process.spawn`. Parameterized with the imported `spawn` and
 * bridge so the module stays testable and the Node import is isolated to the
 * backend host.
 */
function nodeRunner(
  spawn: (
    command: string,
    args: ReadonlyArray<string>,
    options: {
      cwd?: string | undefined;
      env?: Record<string, string> | undefined;
      windowsHide?: boolean | undefined;
    },
  ) => ChildProcess,
  Bridge: typeof import('./NodeProcessBridge').NodeProcessBridge,
): TerminalProcessRunner {
  return {
    spawn(command, args, options) {
      const child = spawn(command, [...args], {
        cwd: options.cwd,
        env: options.env as Record<string, string> | undefined,
        windowsHide: true,
      });
      return new Bridge(child);
    },
  };
}
