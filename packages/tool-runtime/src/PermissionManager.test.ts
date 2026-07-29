import type { EventBusContract, EventDefinition } from '@gamedev-agent/events';
import { describe, expect, it, vi } from 'vitest';
import { PermissionManager } from './PermissionManager';
import type { ToolId } from './ToolTypes';

function makeBus(): EventBusContract {
  return {
    async publish<T>(_def: EventDefinition<T>, _payload: T): Promise<void> {},
    subscribe: () => ({ dispose: () => {} }),
    once: () => ({ dispose: () => {} }),
    unsubscribe: () => {},
    replay: () => [],
    history: () => [],
    clearHistory: () => {},
    use: () => {},
    metrics: () => ({
      published: 0,
      delivered: 0,
      dropped: 0,
      historySize: 0,
      subscriberCount: 0,
      failedHandlers: 0,
      lastPublishMicros: 0,
    }),
    dispose: () => {},
  } as unknown as EventBusContract;
}

describe('PermissionManager', () => {
  it('allows permissions that have allow rules', async () => {
    const pm = new PermissionManager(makeBus(), {
      rules: [
        { permission: 'fs.read', policy: 'allow' },
        { permission: 'fs.write', policy: 'allow' },
      ],
    });

    const result = await pm.check('fs.read' as any, '' as ToolId, '', { kind: 'test' }, null);
    expect(result.granted).toBe(true);
    expect(result.policy).toBe('allow');
  });

  it('denies permissions with deny rules', async () => {
    const pm = new PermissionManager(makeBus(), {
      rules: [
        { permission: 'fs.read', policy: 'allow' },
        { permission: 'fs.write', policy: 'deny' },
      ],
    });

    const result = await pm.check('fs.write' as any, '' as ToolId, '', { kind: 'test' }, null);
    expect(result.granted).toBe(false);
    expect(result.policy).toBe('deny');
  });

  it('denies by default when no rules match', async () => {
    const pm = new PermissionManager(makeBus(), {
      defaultPolicy: 'deny',
    });

    const result = await pm.check(
      'unknown.permission' as any,
      '' as ToolId,
      '',
      { kind: 'test' },
      null,
    );
    expect(result.granted).toBe(false);
  });

  it('allows by default when defaultPolicy is allow', async () => {
    const pm = new PermissionManager(makeBus(), {
      defaultPolicy: 'allow',
    });

    const result = await pm.check(
      'unknown.permission' as any,
      '' as ToolId,
      '',
      { kind: 'test' },
      null,
    );
    expect(result.granted).toBe(true);
  });

  it('prompts user for prompt policy permissions', async () => {
    const promptHandler = vi.fn().mockResolvedValue(true);
    const pm = new PermissionManager(makeBus(), {
      rules: [{ permission: 'fs.delete', policy: 'prompt' }],
      onPermissionPrompt: promptHandler,
    });

    const result = await pm.check(
      'fs.delete' as any,
      'tool-1' as ToolId,
      'files.delete',
      { kind: 'test' },
      null,
    );

    expect(result.granted).toBe(true);
    expect(result.policy).toBe('prompt');
    expect(promptHandler).toHaveBeenCalledWith({
      permission: 'fs.delete',
      toolId: 'tool-1',
      action: 'files.delete',
      actor: { kind: 'test' },
      correlationId: null,
    });
  });

  it('denies prompt when user denies', async () => {
    const promptHandler = vi.fn().mockResolvedValue(false);
    const pm = new PermissionManager(makeBus(), {
      rules: [{ permission: 'fs.delete', policy: 'prompt' }],
      onPermissionPrompt: promptHandler,
    });

    const result = await pm.check(
      'fs.delete' as any,
      'tool-1' as ToolId,
      'files.delete',
      { kind: 'test' },
      null,
    );

    expect(result.granted).toBe(false);
    expect(result.policy).toBe('prompt');
  });

  it('denies prompt when no prompt handler is configured', async () => {
    const pm = new PermissionManager(makeBus(), {
      rules: [{ permission: 'fs.delete', policy: 'prompt' }],
    });

    const result = await pm.check(
      'fs.delete' as any,
      'tool-1' as ToolId,
      'files.delete',
      { kind: 'test' },
      null,
    );

    expect(result.granted).toBe(false);
    expect(result.reason).toContain('no prompt handler');
  });

  it('checkAll returns first denial', async () => {
    const pm = new PermissionManager(makeBus(), {
      rules: [
        { permission: 'fs.read', policy: 'allow' },
        { permission: 'fs.write', policy: 'deny' },
      ],
    });
    const toolId = '' as ToolId;

    const result = await pm.checkAll(
      ['fs.read' as any, 'fs.write' as any],
      toolId,
      '',
      { kind: 'test' },
      null,
    );

    expect(result.granted).toBe(false);
    expect(result.policy).toBe('deny');
  });

  it('setRule adds or updates a rule at runtime', async () => {
    const pm = new PermissionManager(makeBus(), { defaultPolicy: 'deny' });

    pm.setRule({ permission: 'fs.read', policy: 'allow' });

    const result = await pm.check('fs.read' as any, '' as ToolId, '', { kind: 'test' }, null);
    expect(result.granted).toBe(true);
  });

  it('removeRule falls back to default policy', async () => {
    const pm = new PermissionManager(makeBus(), { defaultPolicy: 'deny' });

    pm.setRule({ permission: 'fs.read', policy: 'allow' });
    pm.removeRule('fs.read' as any);

    const result = await pm.check('fs.read' as any, '' as ToolId, '', { kind: 'test' }, null);
    expect(result.granted).toBe(false);
  });

  it('toGrantedSet returns only allow rules', () => {
    const pm = new PermissionManager(makeBus(), {
      rules: [
        { permission: 'fs.read', policy: 'allow' },
        { permission: 'fs.write', policy: 'deny' },
        { permission: 'process.spawn', policy: 'prompt' },
      ],
    });

    const granted = pm.toGrantedSet();
    expect(granted.has('fs.read')).toBe(true);
    expect(granted.has('fs.write')).toBe(false);
    expect(granted.has('process.spawn')).toBe(false);
  });
});
