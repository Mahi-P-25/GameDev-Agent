import { RUNTIME_TOKEN } from '@gamedev-agent/runtime';
import type { Runtime } from '@gamedev-agent/runtime';
import type { StudioKernel } from '@gamedev-agent/kernel';
import { GitToolAdapter, gitDescriptor } from './GitToolAdapter';
import { TOOL_RUNTIME_TOKEN } from './ToolTypes';
import type { ToolManager } from './ToolManager';

export const gitModule: {
  readonly name: string;
  register(kernel: StudioKernel): void | Promise<void>;
} = {
  name: 'nova.git',
  async register(kernel: StudioKernel): Promise<void> {
    if (!kernel.services.has(TOOL_RUNTIME_TOKEN)) {
      kernel.logger.warn('git.module.tool-runtime-missing', {
        msg: 'Tool Runtime is not registered; skipping git tool registration.',
      });
      return;
    }

    if (!kernel.services.has(RUNTIME_TOKEN)) {
      kernel.logger.warn('git.module.runtime-missing', {
        msg: 'Runtime is not registered; skipping git tool registration.',
      });
      return;
    }

    const manager = await kernel.services.resolve<ToolManager>(TOOL_RUNTIME_TOKEN);
    const runtime = await kernel.services.resolve<Runtime>(RUNTIME_TOKEN);

    await manager.register(gitDescriptor, new GitToolAdapter(runtime.git));
    await manager.connect(gitDescriptor.id, { kind: 'director' });
  },
};
