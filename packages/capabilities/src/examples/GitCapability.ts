import type { Json } from '@gamedev-agent/shared';
import { BaseCapability } from '../Capability';
import { type CapabilityDescriptor, asCapabilityId } from '../CapabilityDescriptor';
import type { CapabilityContext } from '../CapabilityDescriptor';
import { CapabilityExecutionError } from '../CapabilityErrors';

/**
 * Git Capability — version-control operations (status, commit, diff, branch).
 *
 * SPRINT-6 status: interface only. {@link GitCapability.run} validates the
 * requested subcommand and returns a structured acknowledgement; it does NOT
 * spawn `git`. A future implementation invokes the Git CLI or a library behind
 * the same contract.
 */
export const GIT_DESCRIPTOR: CapabilityDescriptor = {
  id: asCapabilityId('nova.capability.git'),
  name: 'Git',
  description: 'Version-control operations: status, commit, diff, branch.',
  version: '0.1.0',
  category: 'vcs',
  permissions: ['fs.read', 'fs.write', 'process.spawn'],
  supportedPlatforms: ['win32', 'darwin', 'linux'],
  requiredTools: [{ name: 'git', minVersion: '2.30.0' }],
  inputs: [
    { name: 'command', type: "'status' | 'commit' | 'diff' | 'branch'", required: true },
    { name: 'message', type: 'string', required: false },
  ],
  outputs: [{ name: 'command', type: 'string', required: true }],
};

export class GitCapability extends BaseCapability {
  constructor() {
    super(GIT_DESCRIPTOR);
  }

  protected async run(context: CapabilityContext): Promise<Json> {
    const input = context.input as { command?: unknown; message?: unknown };
    const command = input.command;
    if (
      command !== 'status' &&
      command !== 'commit' &&
      command !== 'diff' &&
      command !== 'branch'
    ) {
      throw new CapabilityExecutionError(
        this.id,
        'unsupported-command',
        `Git capability received unsupported command: ${String(command)}`,
      );
    }
    if (command === 'commit' && typeof input.message !== 'string') {
      throw new CapabilityExecutionError(
        this.id,
        'missing-message',
        'Git "commit" requires a string "message"',
      );
    }
    context.reportProgress(100, `git.${String(command)}`);
    return { command: String(command) };
  }
}
