import type { Json } from '@gamedev-agent/shared';
import { BaseCapability } from '../Capability';
import { type CapabilityDescriptor, asCapabilityId } from '../CapabilityDescriptor';
import type { CapabilityContext } from '../CapabilityDescriptor';
import { CapabilityExecutionError } from '../CapabilityErrors';

/**
 * Filesystem Capability — read, write, list, and move files and directories.
 *
 * SPRINT-6 status: interface only. {@link FilesystemCapability.run} validates
 * the operation and returns a structured acknowledgement; it does NOT touch the
 * disk. A future implementation backs it with real FS calls behind the same
 * contract.
 */
export const FILESYSTEM_DESCRIPTOR: CapabilityDescriptor = {
  id: asCapabilityId('nova.capability.filesystem'),
  name: 'Filesystem',
  description: 'Read, write, list, and move files and directories.',
  version: '0.1.0',
  category: 'filesystem',
  permissions: ['fs.read', 'fs.write', 'fs.delete'],
  supportedPlatforms: ['win32', 'darwin', 'linux', 'web'],
  requiredTools: [],
  inputs: [
    { name: 'operation', type: "'read' | 'write' | 'list' | 'move'", required: true },
    { name: 'path', type: 'string', required: true },
  ],
  outputs: [{ name: 'operation', type: 'string', required: true }],
};

export class FilesystemCapability extends BaseCapability {
  constructor() {
    super(FILESYSTEM_DESCRIPTOR);
  }

  protected async run(context: CapabilityContext): Promise<Json> {
    const input = context.input as { operation?: unknown; path?: unknown };
    const operation = input.operation;
    if (
      operation !== 'read' &&
      operation !== 'write' &&
      operation !== 'list' &&
      operation !== 'move'
    ) {
      throw new CapabilityExecutionError(
        this.id,
        'unsupported-operation',
        `Filesystem capability received unsupported operation: ${String(operation)}`,
      );
    }
    if (typeof input.path !== 'string') {
      throw new CapabilityExecutionError(
        this.id,
        'missing-path',
        'Filesystem operations require a string "path"',
      );
    }
    context.reportProgress(100, `fs.${String(operation)}`);
    return { operation: String(operation) };
  }
}
