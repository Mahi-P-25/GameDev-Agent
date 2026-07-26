import type { Json } from '@gamedev-agent/shared';
import { BaseCapability } from '../Capability';
import { type CapabilityDescriptor, asCapabilityId } from '../CapabilityDescriptor';
import type { CapabilityContext } from '../CapabilityDescriptor';
import type { CapabilityHealth } from '../CapabilityDescriptor';
import { CapabilityExecutionError } from '../CapabilityErrors';

/**
 * Blender Capability — 3D modeling, animation, and rendering via Blender.
 *
 * SPRINT-6 status: interface only. {@link BlenderCapability.run} validates the
 * requested operation and returns a structured acknowledgement; it does NOT
 * launch Blender. A future implementation drives the Blender CLI/Python API
 * behind the same contract. The {@link probe} hook is where real tool detection
 * would plug in later.
 */
export const BLENDER_DESCRIPTOR: CapabilityDescriptor = {
  id: asCapabilityId('nova.capability.blender'),
  name: 'Blender',
  description: '3D modeling, animation, and rendering via Blender.',
  version: '0.1.0',
  category: '3d',
  permissions: ['fs.read', 'fs.write', 'process.spawn'],
  supportedPlatforms: ['win32', 'darwin', 'linux'],
  requiredTools: [{ name: 'blender', note: 'Blender 3.x/4.x binary' }],
  inputs: [
    { name: 'operation', type: "'render' | 'import' | 'script'", required: true },
    { name: 'scene', type: 'string', required: false },
  ],
  outputs: [{ name: 'operation', type: 'string', required: true }],
};

export class BlenderCapability extends BaseCapability {
  constructor() {
    super(BLENDER_DESCRIPTOR);
  }

  protected async run(context: CapabilityContext): Promise<Json> {
    const input = context.input as { operation?: unknown; scene?: unknown };
    const operation = input.operation;
    if (operation !== 'render' && operation !== 'import' && operation !== 'script') {
      throw new CapabilityExecutionError(
        this.id,
        'unsupported-operation',
        `Blender capability received unsupported operation: ${String(operation)}`,
      );
    }
    context.reportProgress(100, `blender.${String(operation)}`);
    return { operation: String(operation) };
  }

  protected override async probe(): Promise<CapabilityHealth> {
    // SPRINT-6: no real detection. Concrete tool probing is a future
    // integration; the framework default is `healthy`.
    return 'healthy';
  }
}
