import type { Json } from '@gamedev-agent/shared';
import { BaseCapability } from '../Capability';
import { type CapabilityDescriptor, asCapabilityId } from '../CapabilityDescriptor';
import type { CapabilityContext } from '../CapabilityDescriptor';
import { CapabilityExecutionError } from '../CapabilityErrors';

/**
 * VS Code Capability — opens, edits, and inspects files in the Visual Studio
 * Code editor.
 *
 * SPRINT-6 status: interface only. {@link VSCodeCapability.run} validates the
 * requested action and returns a structured acknowledgement; it does NOT launch
 * the `code` binary. A future implementation wires the concrete editor protocol
 * behind the same descriptor and {@link CapabilityContext} contract, so Roles
 * and the Coordinator are unaffected by the swap.
 */
export const VSCODE_DESCRIPTOR: CapabilityDescriptor = {
  id: asCapabilityId('nova.capability.vscode'),
  name: 'VS Code',
  description: 'Open, edit, and inspect files in Visual Studio Code.',
  version: '0.1.0',
  category: 'editor',
  permissions: ['fs.read', 'fs.write', 'ui.open'],
  supportedPlatforms: ['win32', 'darwin', 'linux'],
  requiredTools: [{ name: 'code', note: 'Visual Studio Code CLI' }],
  inputs: [
    { name: 'action', type: "'open' | 'focus' | 'inspect'", required: true },
    { name: 'path', type: 'string', required: false },
  ],
  outputs: [{ name: 'opened', type: 'boolean', required: true }],
};

export class VSCodeCapability extends BaseCapability {
  constructor() {
    super(VSCODE_DESCRIPTOR);
  }

  protected async run(context: CapabilityContext): Promise<Json> {
    const input = context.input as { action?: unknown; path?: unknown };
    const action = input.action;
    if (action !== 'open' && action !== 'focus' && action !== 'inspect') {
      throw new CapabilityExecutionError(
        this.id,
        'unsupported-action',
        `VS Code capability received unsupported action: ${String(action)}`,
      );
    }
    if (action === 'open' && typeof input.path !== 'string') {
      throw new CapabilityExecutionError(
        this.id,
        'missing-path',
        'VS Code "open" action requires a string "path"',
      );
    }
    context.reportProgress(100, `vscode.${String(action)}`);
    return { opened: action === 'open' };
  }
}
