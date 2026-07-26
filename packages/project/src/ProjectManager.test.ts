import { describe, expect, it } from 'vitest';
import { ProjectConflictError, ProjectNotFoundError, ProjectStateError } from './ProjectErrors';
import {
  ProjectClosed,
  ProjectCreated,
  ProjectDeleted,
  ProjectOpened,
  ProjectRenamed,
  ProjectUpdated,
} from './ProjectEvents';
import type {
  ProjectCreatedPayload,
  ProjectRenamedPayload,
  ProjectUpdatedPayload,
} from './ProjectEvents';
import { ProjectFactory } from './ProjectFactory';
import { ProjectManager } from './ProjectManager';
import { ProjectRegistry } from './ProjectRegistry';
import { FakeEventBus, FixedClock, SequenceIdGenerator } from './test_helpers';

const makeManager = () => {
  const bus = new FakeEventBus();
  const factory = new ProjectFactory({
    clock: new FixedClock(),
    idGenerator: new SequenceIdGenerator(),
  });
  const registry = new ProjectRegistry();
  const manager = new ProjectManager({ eventBus: bus, factory, registry });
  return { bus, manager };
};

describe('ProjectManager — create', () => {
  it('creates, persists, and emits project.created with full payload', async () => {
    const { bus, manager } = makeManager();
    const project = await manager.create({
      name: 'Nova RTS',
      rootPath: '/games/rts',
      engine: 'unity',
    });

    expect(project.status).toBe('draft');
    expect(manager.find(project.id)).toBe(project);

    const events = bus.emitted<ProjectCreatedPayload>(ProjectCreated.type);
    expect(events).toHaveLength(1);
    const payload = events[0];
    expect(payload?.projectId).toBe(project.id);
    expect(payload?.name).toBe('Nova RTS');
    expect(payload?.engine).toBe('unity');
    expect(payload?.memoryNamespace).toBe('nova-rts/memory');
  });

  it('throws ProjectConflictError on a root-path collision', async () => {
    const { manager } = makeManager();
    await manager.create({ name: 'A', rootPath: '/shared' });
    await expect(manager.create({ name: 'B', rootPath: '/shared' })).rejects.toBeInstanceOf(
      ProjectConflictError,
    );
  });
});

describe('ProjectManager — open / close lifecycle', () => {
  it('opens a draft project (draft → open) and emits project.opened', async () => {
    const { bus, manager } = makeManager();
    const created = await manager.create({ name: 'P', rootPath: '/x' });
    const opened = await manager.open(created.id);

    expect(opened.status).toBe('open');
    expect(bus.emitted(ProjectOpened.type)).toHaveLength(1);
  });

  it('opening an already-open project is idempotent (no second event)', async () => {
    const { bus, manager } = makeManager();
    const created = await manager.create({ name: 'P', rootPath: '/x' });
    await manager.open(created.id);
    await manager.open(created.id);
    expect(bus.emitted(ProjectOpened.type)).toHaveLength(1);
    expect(manager.get(created.id).status).toBe('open');
  });

  it('closes an open project (open → closed) and emits project.closed', async () => {
    const { bus, manager } = makeManager();
    const created = await manager.create({ name: 'P', rootPath: '/x' });
    await manager.open(created.id);
    const closed = await manager.close(created.id);

    expect(closed.status).toBe('closed');
    expect(bus.emitted(ProjectClosed.type)).toHaveLength(1);
  });

  it('throws ProjectStateError when closing a draft project', async () => {
    const { manager } = makeManager();
    const created = await manager.create({ name: 'P', rootPath: '/x' });
    await expect(manager.close(created.id)).rejects.toBeInstanceOf(ProjectStateError);
  });

  it('throws ProjectNotFoundError for unknown ids', async () => {
    const { manager } = makeManager();
    await expect(manager.open('missing' as never)).rejects.toBeInstanceOf(ProjectNotFoundError);
    await expect(manager.close('missing' as never)).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});

describe('ProjectManager — rename / update', () => {
  it('renames and emits project.renamed plus project.updated', async () => {
    const { bus, manager } = makeManager();
    const created = await manager.create({ name: 'Old', rootPath: '/x' });
    const renamed = await manager.rename(created.id, 'New');

    expect(renamed.name).toBe('New');
    expect(bus.emitted<ProjectRenamedPayload>(ProjectRenamed.type)[0]?.previousName).toBe('Old');
    expect(bus.emitted<ProjectRenamedPayload>(ProjectRenamed.type)[0]?.name).toBe('New');
    expect(bus.emitted(ProjectUpdated.type)).toHaveLength(1);
  });

  it('updates arbitrary fields and reports changed fields', async () => {
    const { bus, manager } = makeManager();
    const created = await manager.create({ name: 'P', rootPath: '/x' });
    const updated = await manager.update(created.id, { engine: 'godot', tags: ['strategy'] });

    expect(updated.engine).toBe('godot');
    expect(updated.tags).toEqual(['strategy']);
    const updatedEvent = bus.emitted<ProjectUpdatedPayload>(ProjectUpdated.type)[0];
    expect(updatedEvent?.changedFields).toEqual(expect.arrayContaining(['engine', 'tags']));
  });

  it('does not emit project.updated for an empty patch', async () => {
    const { bus, manager } = makeManager();
    const created = await manager.create({ name: 'P', rootPath: '/x' });
    await manager.update(created.id, {});
    expect(bus.emitted(ProjectUpdated.type)).toHaveLength(0);
  });
});

describe('ProjectManager — delete', () => {
  it('emits project.deleted and removes the project', async () => {
    const { bus, manager } = makeManager();
    const created = await manager.create({ name: 'P', rootPath: '/x' });
    await manager.delete(created.id);

    expect(bus.emitted(ProjectDeleted.type)).toHaveLength(1);
    expect(manager.find(created.id)).toBeUndefined();
    expect(manager.list()).toHaveLength(0);
  });

  it('throws ProjectNotFoundError when deleting an unknown project', async () => {
    const { manager } = makeManager();
    await expect(manager.delete('missing' as never)).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});

describe('ProjectManager — list / validate', () => {
  it('lists created projects', async () => {
    const { manager } = makeManager();
    const a = await manager.create({ name: 'A', rootPath: '/a' });
    const b = await manager.create({ name: 'B', rootPath: '/b' });
    expect(manager.list().map((p) => p.id)).toEqual([a.id, b.id]);
  });

  it('validate returns no violations for a healthy project', async () => {
    const { manager } = makeManager();
    const created = await manager.create({ name: 'P', rootPath: '/x' });
    expect(manager.validate(created.id)).toEqual([]);
  });

  it('validate throws ProjectNotFoundError for unknown id', async () => {
    const { manager } = makeManager();
    expect(() => manager.validate('missing' as never)).toThrow(ProjectNotFoundError);
  });
});

describe('ProjectManager — disposal', () => {
  it('clears the registry on dispose', async () => {
    const { manager } = makeManager();
    await manager.create({ name: 'P', rootPath: '/x' });
    manager.dispose();
    expect(manager.list()).toHaveLength(0);
  });
});
