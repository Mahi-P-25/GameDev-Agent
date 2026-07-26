import { createServiceToken } from '@gamedev-agent/di';
import type { StudioKernel } from '@gamedev-agent/kernel';
import { Runtime } from './Runtime';
import { browserExecutor } from './executor';

/** DI token for the composed {@link Runtime}. */
export const RUNTIME_TOKEN = createServiceToken<Runtime>('nova.runtime');

/**
 * The **browser-safe** Runtime kernel module.
 *
 * This is the module the Studio React application boots. It imports NO Node.js
 * APIs — no `node:child_process`, no `node:fs`. The {@link Runtime} is
 * constructed with the {@link browserExecutor}, which refuses to spawn
 * processes, so the UI can never trigger real shell execution from a React
 * component. The providers still expose truthful *status*, *capabilities*, and
 * *health* (pure reads), and the host can feed real observations (file opens,
 * git branch) through them — but execution stays in the backend/Runtime layer.
 *
 * Even so, the Studio gains genuine awareness: the agent registry, planning,
 * and Command Center can resolve `RUNTIME_TOKEN` to read the workspace truth
 * and to express intent, while real side effects are performed only by the Node
 * runtime module in the Nova backend.
 */
export const runtimeModule: {
  readonly name: string;
  register(kernel: StudioKernel): void;
} = {
  name: 'nova.runtime',
  register(kernel: StudioKernel): void {
    const logger = kernel.logger.child('runtime');
    kernel.registerService({
      token: RUNTIME_TOKEN,
      singleton: true,
      factory: () =>
        new Runtime({
          workspaceRoot: process.cwd(),
          bus: kernel.events,
          executor: browserExecutor(),
          logger,
          buildConfig: { command: 'npm', args: ['run', 'build'] },
          testConfig: { command: 'npm', args: ['test'] },
        }),
    });
  },
};
