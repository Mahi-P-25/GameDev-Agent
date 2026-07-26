import { describe, expect, it } from 'vitest';
import { DuplicateProjectError, ProjectConflictError, ProjectNotFoundError } from './ProjectErrors';
import { ProjectFactory } from './ProjectFactory';
import { ProjectRegistry } from './ProjectRegistry';
import { FixedClock, SequenceIdGenerator } from './test_helpers';

const factory = new ProjectFactory({
  clock: new FixedClock(),
  idGenerator: new SequenceIdGenerator(),
});

describe('ProjectRegistry — add / get', () => {
  it('stores and retrieves a project by id', () => {
    const registry = new ProjectRegistry();
    const project = factory.create({ name: 'P', rootPath: '/x' });
    registry.add(project);
    expect(registry.get(project.id)).toBe(project);
    expect(registry.size).toBe(1);
  });

  it('throws DuplicateProjectError when adding the same id twice', () => {
    const registry = new ProjectRegistry();
    const project = factory.create({ name: 'P', rootPath: '/x' });
    registry.add(project);
    expect(() => registry.add(project)).toThrow(DuplicateProjectError);
  });

  it('throws ProjectConflictError when two projects share a root path', () => {
    const registry = new ProjectRegistry();
    const a = factory.create({ name: 'A', rootPath: '/shared' });
    const b = factory.create({ name: 'B', rootPath: '/shared' });
    registry.add(a);
    expect(() => registry.add(b)).toThrow(ProjectConflictError);
  });

  it('finds a project by root path', () => {
    const registry = new ProjectRegistry();
    const project = factory.create({ name: 'P', rootPath: '/x' });
    registry.add(project);
    expect(registry.findByPath('/x')?.id).toBe(project.id);
    expect(registry.hasPath('/x')).toBe(true);
    expect(registry.hasPath('/nope')).toBe(false);
  });
});

describe('ProjectRegistry — update', () => {
  it('updates in place when id matches', () => {
    const registry = new ProjectRegistry();
    const original = factory.create({ name: 'P', rootPath: '/x' });
    registry.add(original);
    const next = { ...original, name: 'Q' };
    registry.update(next);
    expect(registry.get(original.id).name).toBe('Q');
  });

  it('throws ProjectNotFoundError when updating an unknown id', () => {
    const registry = new ProjectRegistry();
    const project = factory.create({ name: 'P', rootPath: '/x' });
    expect(() => registry.update(project)).toThrow(ProjectNotFoundError);
  });

  it('moves the root-path index when the path changes', () => {
    const registry = new ProjectRegistry();
    const project = factory.create({ name: 'P', rootPath: '/x' });
    registry.add(project);
    registry.update({ ...project, rootPath: '/y' });
    expect(registry.findByPath('/x')).toBeUndefined();
    expect(registry.findByPath('/y')?.id).toBe(project.id);
  });
});

describe('ProjectRegistry — remove / list / clear', () => {
  it('removes a project and its path index', () => {
    const registry = new ProjectRegistry();
    const project = factory.create({ name: 'P', rootPath: '/x' });
    registry.add(project);
    registry.remove(project.id);
    expect(registry.has(project.id)).toBe(false);
    expect(registry.hasPath('/x')).toBe(false);
    expect(registry.size).toBe(0);
  });

  it('throws ProjectNotFoundError when removing an unknown id', () => {
    const registry = new ProjectRegistry();
    const project = factory.create({ name: 'P', rootPath: '/x' });
    expect(() => registry.remove(project.id)).toThrow(ProjectNotFoundError);
  });

  it('lists projects in insertion order', () => {
    const registry = new ProjectRegistry();
    const a = factory.create({ name: 'A', rootPath: '/a' });
    const b = factory.create({ name: 'B', rootPath: '/b' });
    registry.add(a);
    registry.add(b);
    expect(registry.list().map((p) => p.name)).toEqual(['A', 'B']);
  });

  it('clears all state', () => {
    const registry = new ProjectRegistry();
    registry.add(factory.create({ name: 'A', rootPath: '/a' }));
    registry.clear();
    expect(registry.size).toBe(0);
  });
});
