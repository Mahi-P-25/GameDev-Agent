import { describe, expect, it } from 'vitest';
import { asCapabilityId } from '../src/CapabilityDescriptor';
import {
  PermissionDeniedError,
  ToolUnavailableError,
  UnsupportedPlatformError,
} from '../src/CapabilityErrors';
import { CapabilityManager } from '../src/CapabilityManager';
import { EchoCapability, FakeEventBus, FakeToolProbe, makeTestDescriptor } from './test_helpers';

const TEST_ID = asCapabilityId('nova.capability.test');

interface ManagerBundle {
  manager: CapabilityManager;
  eventBus: FakeEventBus;
  toolProbe: FakeToolProbe;
}

function makeBundle(overrides: Record<string, unknown> = {}): ManagerBundle {
  const eventBus = new FakeEventBus();
  const toolProbe = new FakeToolProbe();
  const capability = new EchoCapability();
  const options = {
    eventBus,
    toolProbe,
    capabilities: [capability],
    platform: 'win32' as const,
    grantedPermissions: ['process.spawn'] as const,
    ...overrides,
  };
  return { manager: new CapabilityManager(options), eventBus, toolProbe };
}

describe('CapabilityManager — lifecycle', () => {
  it('emits capability.registered on construction for built-in capabilities', () => {
    const { eventBus } = makeBundle();
    expect(eventBus.emitted('capability.registered')).toHaveLength(1);
  });

  it('enables a capability and emits capability.enabled', async () => {
    const { manager, eventBus } = makeBundle();
    await manager.enable(TEST_ID);
    expect(manager.isEnabled(TEST_ID)).toBe(true);
    expect(eventBus.emitted('capability.enabled')).toHaveLength(1);
  });

  it('disables a capability and emits capability.disabled', async () => {
    const { manager, eventBus } = makeBundle();
    await manager.enable(TEST_ID);
    await manager.disable(TEST_ID);
    expect(manager.isEnabled(TEST_ID)).toBe(false);
    expect(eventBus.emitted('capability.disabled')).toHaveLength(1);
  });

  it('rejects enable on an unsupported platform with UnsupportedPlatformError', async () => {
    const { manager } = makeBundle({ platform: 'web' });
    await expect(manager.enable(TEST_ID)).rejects.toBeInstanceOf(UnsupportedPlatformError);
  });

  it('rejects enable when a required tool is unavailable', async () => {
    const { manager, toolProbe } = makeBundle({
      capabilities: [
        new EchoCapability(makeTestDescriptor({ requiredTools: [{ name: 'missing-tool' }] })),
      ],
    });
    toolProbe.block('missing-tool');
    await expect(manager.enable(TEST_ID)).rejects.toBeInstanceOf(ToolUnavailableError);
  });

  it('auto-enables capabilities that satisfy platform & tools when autoEnable is set', async () => {
    const bundle = makeBundle({ autoEnable: true });
    await bundle.manager.init();
    expect(bundle.manager.isEnabled(TEST_ID)).toBe(true);
  });
});

describe('CapabilityManager — execution gates', () => {
  it('rejects a disabled capability with a capability.failed event (disabled)', async () => {
    const { manager, eventBus } = makeBundle();
    const result = await manager.execute(TEST_ID, { value: 'x' });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('disabled');
    expect(eventBus.emitted('capability.failed')).toHaveLength(1);
  });

  it('rejects execution without the required permission', async () => {
    const { manager } = makeBundle({ grantedPermissions: [] });
    await manager.enable(TEST_ID);
    const result = await manager.execute(TEST_ID, { value: 'x' });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('permission-denied');
    expect(result.error?.message).toContain('process.spawn');
    expect(() => {
      throw new PermissionDeniedError(TEST_ID, ['process.spawn']);
    }).toThrow(PermissionDeniedError);
  });

  it('rejects invalid input', async () => {
    const { manager } = makeBundle();
    await manager.enable(TEST_ID);
    const result = await manager.execute(TEST_ID, { wrongKey: 'x' });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('invalid-input');
  });

  it('executes an enabled, permitted, valid capability end-to-end', async () => {
    const { manager, eventBus } = makeBundle();
    await manager.enable(TEST_ID);
    const result = await manager.execute(TEST_ID, { value: 'hello' }, { correlationId: 'corr-1' });
    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ echo: 'hello' });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(eventBus.emitted('capability.requested')).toHaveLength(1);
    expect(eventBus.emitted('capability.started')).toHaveLength(1);
    expect(eventBus.emitted('capability.completed')).toHaveLength(1);
  });
});

describe('CapabilityManager — health', () => {
  it('assesses health and emits capability.health-changed on transition', async () => {
    const { manager, eventBus } = makeBundle();
    const health = await manager.assessHealth(TEST_ID);
    expect(health).toBe('healthy');
    expect(eventBus.emitted('capability.health-changed')).toHaveLength(1);
    await manager.assessHealth(TEST_ID);
    expect(eventBus.emitted('capability.health-changed')).toHaveLength(1);
  });
});

describe('CapabilityManager — queries & teardown', () => {
  it('exposes descriptors and disposal clears everything', () => {
    const { manager } = makeBundle();
    expect(manager.descriptors()).toHaveLength(1);
    manager.dispose();
    expect(manager.descriptors()).toHaveLength(0);
  });
});
