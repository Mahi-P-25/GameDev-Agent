import { describe, expect, it } from 'vitest';
import { ToolSchemaRegistry } from './ToolSchemaRegistry';
import type { ToolCapability } from './ToolTypes';

describe('ToolSchemaRegistry', () => {
  it('returns default schema for unknown actions', () => {
    const registry = new ToolSchemaRegistry();
    const schema = registry.get('unknown.action');
    expect(schema.input).toEqual({
      type: 'object',
      properties: {},
      additionalProperties: true,
    });
  });

  it('stores and retrieves schemas by action name', () => {
    const registry = new ToolSchemaRegistry();
    registry.set('files.read', {
      input: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    });

    const schema = registry.get('files.read');
    expect(schema.input).toHaveProperty('properties.path');
  });

  it('registers schemas from capabilities via getSchema callback', () => {
    const registry = new ToolSchemaRegistry();
    const capabilities: ToolCapability[] = [
      {
        id: 'files',
        name: 'Files',
        description: 'File operations',
        actions: ['files.read', 'files.write'],
        permissions: ['fs.read'],
      },
    ];

    registry.register('tool-1', capabilities, (action) => {
      if (action === 'files.read') {
        return {
          input: { type: 'object', properties: { path: { type: 'string' } } },
        };
      }
      return undefined;
    });

    expect(registry.has('files.read')).toBe(true);
    expect(registry.has('files.write')).toBe(false);

    const schema = registry.getForTool('tool-1', 'files.read');
    expect((schema.input as any).properties.path).toEqual({ type: 'string' });
  });

  it('unregisters all schemas for a tool', () => {
    const registry = new ToolSchemaRegistry();
    registry.set('tool-1:files.read', { input: {} });
    registry.set('files.read', { input: {} });
    registry.set('tool-2:files.read', { input: {} });

    registry.unregister('tool-1');

    expect(registry.has('files.read')).toBe(true);
    expect(registry.getForTool('tool-2', 'files.read').input).toBeDefined();
  });

  it('lists registered action names', () => {
    const registry = new ToolSchemaRegistry();
    registry.set('files.read', { input: {} });
    registry.set('files.write', { input: {} });
    registry.set('terminal.run', { input: {} });

    const actions = registry.actions();
    expect(actions).toContain('files.read');
    expect(actions).toContain('files.write');
    expect(actions).toContain('terminal.run');
  });

  it('clears all schemas', () => {
    const registry = new ToolSchemaRegistry();
    registry.set('files.read', { input: {} });
    registry.clear();

    expect(registry.has('files.read')).toBe(false);
    expect(registry.actions()).toHaveLength(0);
  });
});
