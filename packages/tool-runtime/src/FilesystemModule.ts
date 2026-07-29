import type { StudioKernel } from '@gamedev-agent/kernel';
import { FilesystemToolAdapter, filesystemDescriptor } from './FilesystemToolAdapter';
import type { FSImplementation } from './FilesystemToolAdapter';
import type { ToolManager } from './ToolManager';
import { TOOL_RUNTIME_TOKEN } from './ToolTypes';

export interface FilesystemModuleOptions {
  readonly fs: FSImplementation;
}

export const filesystemModule: {
  readonly name: string;
  register(kernel: StudioKernel, options?: FilesystemModuleOptions): void | Promise<void>;
} = {
  name: 'nova.filesystem',
  async register(kernel: StudioKernel, options?: FilesystemModuleOptions): Promise<void> {
    if (!kernel.services.has(TOOL_RUNTIME_TOKEN)) {
      kernel.logger.warn('filesystem.module.tool-runtime-missing', {
        msg: 'Tool Runtime is not registered; skipping filesystem tool registration.',
      });
      return;
    }

    if (options === undefined) {
      kernel.logger.warn('filesystem.module.no-options', {
        msg: 'No FilesystemModuleOptions provided; skipping filesystem tool registration.',
      });
      return;
    }

    const manager = await kernel.services.resolve<ToolManager>(TOOL_RUNTIME_TOKEN);
    const adapter = new FilesystemToolAdapter(options.fs);

    await manager.register(filesystemDescriptor, adapter);
    await manager.connect(filesystemDescriptor.id, { kind: 'director' });
  },
};
