import type { StudioKernel } from '@gamedev-agent/kernel';
import type { ProcessExecutor } from '@gamedev-agent/runtime';
import { TerminalToolAdapter, terminalDescriptor } from './TerminalToolAdapter';
import type { ToolManager } from './ToolManager';
import { TOOL_RUNTIME_TOKEN } from './ToolTypes';

export interface TerminalModuleOptions {
  readonly executor: ProcessExecutor;
  readonly workspaceRoot: string;
}

export const terminalModule: {
  readonly name: string;
  register(kernel: StudioKernel, options?: TerminalModuleOptions): void | Promise<void>;
} = {
  name: 'nova.terminal',
  async register(kernel: StudioKernel, options?: TerminalModuleOptions): Promise<void> {
    if (!kernel.services.has(TOOL_RUNTIME_TOKEN)) {
      kernel.logger.warn('terminal.module.tool-runtime-missing', {
        msg: 'Tool Runtime is not registered; skipping terminal tool registration.',
      });
      return;
    }

    if (options === undefined) {
      kernel.logger.warn('terminal.module.no-options', {
        msg: 'No TerminalModuleOptions provided; skipping terminal tool registration.',
      });
      return;
    }

    const manager = await kernel.services.resolve<ToolManager>(TOOL_RUNTIME_TOKEN);
    const adapter = new TerminalToolAdapter(options.executor, options.workspaceRoot);

    await manager.register(terminalDescriptor, adapter);
    await manager.connect(terminalDescriptor.id, { kind: 'director' });
  },
};
