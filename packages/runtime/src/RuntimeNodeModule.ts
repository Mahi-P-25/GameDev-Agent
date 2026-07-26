import type { StudioKernel } from '@gamedev-agent/kernel';
import { NodeProcessExecutor } from './NodeExecutor';
import { Runtime } from './Runtime';
import { RUNTIME_TOKEN } from './RuntimeModule';

/**
 * The **Node** Runtime kernel module.
 *
 * This is the backend variant. It imports `node:child_process` (via
 * {@link NodeProcessExecutor}) and `node:fs` so the {@link Runtime} performs
 * genuine process execution and filesystem observation. It must ONLY be booted
 * by the Nova Runtime/backend host — never by the Studio web bundle, which uses
 * {@link runtimeModule} instead.
 *
 * Because it resolves the same {@link RUNTIME_TOKEN}, every consumer (agents,
 * planner, Command Center) gets the real, executing Runtime in the backend and
 * the browser-safe one in the UI, with zero code changes at the call site.
 */
export const runtimeNodeModule: {
  readonly name: string;
  register(kernel: StudioKernel): void;
} = {
  name: 'nova.runtime.node',
  register(kernel: StudioKernel): void {
    const logger = kernel.logger.child('runtime');
    kernel.registerService({
      token: RUNTIME_TOKEN,
      singleton: true,
      factory: () =>
        new Runtime({
          workspaceRoot: process.cwd(),
          bus: kernel.events,
          executor: new NodeProcessExecutor(),
          logger,
          buildConfig: { command: 'npm', args: ['run', 'build'] },
          testConfig: { command: 'npm', args: ['test'] },
        }),
    });
  },
};
