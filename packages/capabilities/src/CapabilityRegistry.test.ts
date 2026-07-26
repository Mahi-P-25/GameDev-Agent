import { describe, expect, it } from 'vitest';
import { asCapabilityId } from '../src/CapabilityDescriptor';
import { CapabilityNotFoundError, DuplicateCapabilityError } from '../src/CapabilityErrors';
import { CapabilityRegistry } from '../src/CapabilityRegistry';
import { EchoCapability, makeTestDescriptor } from './test_helpers';

function makeRegistry(): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  registry.register(new EchoCapability());
  return registry;
}

describe('CapabilityRegistry', () => {
  it('registers a capability and reports presence', () => {
    const registry = makeRegistry();
    expect(registry.has(asCapabilityId('nova.capability.test'))).toBe(true);
    expect(registry.ids()).toHaveLength(1);
    expect(registry.descriptors()).toHaveLength(1);
  });

  it('throws DuplicateCapabilityError on re-registration', () => {
    const registry = new CapabilityRegistry();
    registry.register(new EchoCapability());
    expect(() => registry.register(new EchoCapability())).toThrow(DuplicateCapabilityError);
  });

  it('throws CapabilityNotFoundError for unknown lookups', () => {
    const registry = new CapabilityRegistry();
    expect(() => registry.get(asCapabilityId('missing'))).toThrow(CapabilityNotFoundError);
    expect(registry.find(asCapabilityId('missing'))).toBeUndefined();
  });

  it('starts disabled and tracks enabled state', () => {
    const registry = makeRegistry();
    const id = asCapabilityId('nova.capability.test');
    expect(registry.isEnabled(id)).toBe(false);
    registry.setEnabled(id, true);
    expect(registry.isEnabled(id)).toBe(true);
  });

  it('tracks health state', () => {
    const registry = makeRegistry();
    const id = asCapabilityId('nova.capability.test');
    expect(registry.healthOf(id)).toBe('unknown');
    registry.setHealth(id, 'healthy');
    expect(registry.healthOf(id)).toBe('healthy');
  });

  it('unregister disposes and forgets the capability', () => {
    const registry = new CapabilityRegistry();
    const capability = new EchoCapability();
    let disposed = false;
    capability.dispose = () => {
      disposed = true;
    };
    registry.register(capability);
    registry.unregister(capability.id);
    expect(registry.has(capability.id)).toBe(false);
    expect(disposed).toBe(true);
  });

  it('filters by platform and category', () => {
    const registry = new CapabilityRegistry();
    registry.register(
      new EchoCapability(
        makeTestDescriptor({ id: asCapabilityId('a'), supportedPlatforms: ['web'] }),
      ),
    );
    registry.register(
      new EchoCapability(makeTestDescriptor({ id: asCapabilityId('b'), category: 'editor' })),
    );
    expect(registry.byPlatform('web').map((d) => d.id)).toEqual(['a']);
    expect(registry.byCategory('editor').map((d) => d.id)).toEqual(['b']);
  });

  it('clear empties the registry and disposes capabilities', () => {
    const registry = makeRegistry();
    registry.clear();
    expect(registry.ids()).toHaveLength(0);
  });
});
