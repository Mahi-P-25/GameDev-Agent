import type { Json } from '@gamedev-agent/shared';
import { BaseCapability } from '../Capability';
import { type CapabilityDescriptor, asCapabilityId } from '../CapabilityDescriptor';
import type { CapabilityContext } from '../CapabilityDescriptor';
import { CapabilityExecutionError } from '../CapabilityErrors';

/**
 * Browser Capability — open URLs and drive web interactions for QA and research.
 *
 * SPRINT-6 status: interface only. {@link BrowserCapability.run} validates the
 * navigation target and returns a structured acknowledgement; it does NOT launch
 * a browser. A future implementation drives a real browser engine behind the
 * same contract.
 */
export const BROWSER_DESCRIPTOR: CapabilityDescriptor = {
  id: asCapabilityId('nova.capability.browser'),
  name: 'Browser',
  description: 'Open URLs and drive web interactions for QA and research.',
  version: '0.1.0',
  category: 'browser',
  permissions: ['net.outbound', 'ui.open'],
  supportedPlatforms: ['win32', 'darwin', 'linux', 'web'],
  requiredTools: [],
  inputs: [
    { name: 'action', type: "'open' | 'navigate' | 'snapshot'", required: true },
    { name: 'url', type: 'string', required: false },
  ],
  outputs: [{ name: 'action', type: 'string', required: true }],
};

export class BrowserCapability extends BaseCapability {
  constructor() {
    super(BROWSER_DESCRIPTOR);
  }

  protected async run(context: CapabilityContext): Promise<Json> {
    const input = context.input as { action?: unknown; url?: unknown };
    const action = input.action;
    if (action !== 'open' && action !== 'navigate' && action !== 'snapshot') {
      throw new CapabilityExecutionError(
        this.id,
        'unsupported-action',
        `Browser capability received unsupported action: ${String(action)}`,
      );
    }
    if ((action === 'navigate' || action === 'open') && typeof input.url !== 'string') {
      throw new CapabilityExecutionError(
        this.id,
        'missing-url',
        `Browser "${String(action)}" requires a string "url"`,
      );
    }
    context.reportProgress(100, `browser.${String(action)}`);
    return { action: String(action) };
  }
}
