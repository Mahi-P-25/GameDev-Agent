import type { Json } from '@gamedev-agent/shared';
import { BaseCapability } from '../Capability';
import { type CapabilityDescriptor, asCapabilityId } from '../CapabilityDescriptor';
import type { CapabilityContext } from '../CapabilityDescriptor';
import { CapabilityExecutionError } from '../CapabilityErrors';

/**
 * Three.js Capability — programmatic 3D scene construction for the web.
 *
 * SPRINT-6 status: interface only. {@link ThreeJsCapability.run} validates the
 * scene description and returns a structured acknowledgement; it does NOT execute
 * WebGL. A future implementation compiles/runs scenes behind the same contract.
 */
export const THREE_JS_DESCRIPTOR: CapabilityDescriptor = {
  id: asCapabilityId('nova.capability.three-js'),
  name: 'Three.js',
  description: 'Programmatic 3D scene construction and rendering for the web.',
  version: '0.1.0',
  category: 'graphics',
  permissions: ['fs.read', 'fs.write', 'net.outbound'],
  supportedPlatforms: ['web', 'win32', 'darwin', 'linux'],
  requiredTools: [{ name: 'three', note: 'three npm package' }],
  inputs: [
    { name: 'operation', type: "'create-scene' | 'add-mesh' | 'export'", required: true },
    { name: 'spec', type: 'object', required: false },
  ],
  outputs: [{ name: 'operation', type: 'string', required: true }],
};

export class ThreeJsCapability extends BaseCapability {
  constructor() {
    super(THREE_JS_DESCRIPTOR);
  }

  protected async run(context: CapabilityContext): Promise<Json> {
    const input = context.input as { operation?: unknown; spec?: unknown };
    const operation = input.operation;
    if (operation !== 'create-scene' && operation !== 'add-mesh' && operation !== 'export') {
      throw new CapabilityExecutionError(
        this.id,
        'unsupported-operation',
        `Three.js capability received unsupported operation: ${String(operation)}`,
      );
    }
    if ((operation === 'add-mesh' || operation === 'create-scene') && input.spec === undefined) {
      throw new CapabilityExecutionError(
        this.id,
        'missing-spec',
        `Three.js "${String(operation)}" requires a "spec" object`,
      );
    }
    context.reportProgress(100, `three.${String(operation)}`);
    return { operation: String(operation) };
  }
}
