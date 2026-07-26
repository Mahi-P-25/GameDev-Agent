import type { Json } from '@gamedev-agent/shared';
import { describe, expect, it } from 'vitest';
import { BaseCapability } from '../src/Capability';
import { CapabilityContextImpl } from '../src/CapabilityContext';
import type { CapabilityContext as CapabilityContextContract } from '../src/CapabilityDescriptor';
import {
  type CapabilityDescriptor,
  type CapabilityId,
  asCapabilityId,
} from '../src/CapabilityDescriptor';
import { CapabilityExecutionError } from '../src/CapabilityErrors';

const DESCRIPTOR: CapabilityDescriptor = {
  id: asCapabilityId('nova.capability.sample'),
  name: 'Sample',
  description: 'sample',
  version: '0.1.0',
  category: 'shell',
  permissions: [],
  supportedPlatforms: ['win32'],
  requiredTools: [],
  inputs: [],
  outputs: [],
};

class OkCapability extends BaseCapability {
  constructor() {
    super(DESCRIPTOR);
  }
  protected async run(context: CapabilityContextContract): Promise<Json> {
    context.reportProgress(100);
    return { ok: true };
  }
}

class BoomCapability extends BaseCapability {
  constructor() {
    super(DESCRIPTOR);
  }
  protected async run(_context: CapabilityContextContract): Promise<Json> {
    throw new CapabilityExecutionError(this.id, 'boom', 'kaboom');
  }
}

describe('BaseCapability', () => {
  it('returns a success result with typed output and duration', async () => {
    const result = await new OkCapability().execute(
      new CapabilityContextImpl(asCapabilityId('nova.capability.sample'), null),
    );
    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ ok: true });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('converts a CapabilityExecutionError into a structured failure', async () => {
    const result = await new BoomCapability().execute(
      new CapabilityContextImpl(asCapabilityId('nova.capability.sample'), null),
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('boom');
    expect(result.error?.message).toBe('kaboom');
  });

  it('rejects concurrent execution', async () => {
    let resolveInner: () => void = () => {};
    class Slow extends BaseCapability {
      constructor() {
        super(DESCRIPTOR);
      }
      protected async run(_context: CapabilityContextContract): Promise<Json> {
        await new Promise<void>((r) => {
          resolveInner = r;
        });
        return null;
      }
    }
    const cap = new Slow();
    const ctx = new CapabilityContextImpl(asCapabilityId('nova.capability.sample'), null);
    const first = cap.execute(ctx);
    const second = await cap.execute(ctx);
    resolveInner();
    await first;
    expect(second.ok).toBe(false);
    expect(second.error?.code).toBe('concurrent-execution');
  });

  it('exposes the id accessor', () => {
    const cap = new OkCapability();
    expect(cap.id).toBe(asCapabilityId('nova.capability.sample') as CapabilityId);
  });

  it('defaults health to healthy', async () => {
    expect(await new OkCapability().health()).toBe('healthy');
  });
});

describe('CapabilityContextImpl', () => {
  it('clamps and never decreases progress', () => {
    const ctx = new CapabilityContextImpl(asCapabilityId('nova.capability.sample'), { a: 1 });
    ctx.reportProgress(40);
    ctx.reportProgress(10);
    ctx.reportProgress(200);
    expect(ctx.currentProgress).toBe(100);
    expect(ctx.progressHistory).toHaveLength(3);
  });

  it('captures input, correlationId and metadata', () => {
    const ctx = new CapabilityContextImpl(
      asCapabilityId('nova.capability.sample'),
      { a: 1 },
      'corr',
      undefined,
      { tag: 'x' },
    );
    expect(ctx.input).toEqual({ a: 1 });
    expect(ctx.correlationId).toBe('corr');
    expect(ctx.metadata).toEqual({ tag: 'x' });
  });
});
