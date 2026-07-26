import type { Json } from '@gamedev-agent/shared';
import { BaseCapability } from '../Capability';
import { type CapabilityDescriptor, asCapabilityId } from '../CapabilityDescriptor';
import type { CapabilityContext } from '../CapabilityDescriptor';
import { CapabilityExecutionError } from '../CapabilityErrors';

/**
 * Terminal Capability — run shell commands in a managed process.
 *
 * SPRINT-6 status: interface only. {@link TerminalCapability.run} validates the
 * command shape and returns a structured acknowledgement; it does NOT spawn a
 * shell. A future implementation manages a real process behind the same
 * contract, streaming output through {@link CapabilityContext.reportProgress}.
 */
export const TERMINAL_DESCRIPTOR: CapabilityDescriptor = {
  id: asCapabilityId('nova.capability.terminal'),
  name: 'Terminal',
  description: 'Run shell commands in a managed, sandboxed process.',
  version: '0.1.0',
  category: 'shell',
  permissions: ['process.spawn', 'process.kill', 'system.env'],
  supportedPlatforms: ['win32', 'darwin', 'linux'],
  requiredTools: [],
  inputs: [
    { name: 'command', type: 'string', required: true },
    { name: 'args', type: 'string[]', required: false },
  ],
  outputs: [{ name: 'command', type: 'string', required: true }],
};

export class TerminalCapability extends BaseCapability {
  constructor() {
    super(TERMINAL_DESCRIPTOR);
  }

  protected async run(context: CapabilityContext): Promise<Json> {
    const input = context.input as { command?: unknown; args?: unknown };
    if (typeof input.command !== 'string') {
      throw new CapabilityExecutionError(
        this.id,
        'missing-command',
        'Terminal capability requires a string "command"',
      );
    }
    if (input.args !== undefined && !Array.isArray(input.args)) {
      throw new CapabilityExecutionError(
        this.id,
        'invalid-args',
        'Terminal "args" must be an array of strings',
      );
    }
    context.reportProgress(50, `spawning ${String(input.command)}`);
    context.reportProgress(100, 'command acknowledged');
    return { command: String(input.command) };
  }
}
