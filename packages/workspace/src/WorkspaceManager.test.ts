import { describe, expect, it } from 'vitest';
import type { ProjectId } from '@gamedev-agent/project';
import type { Timestamp } from '@gamedev-agent/shared';
import {
  WorkspaceArchived,
  WorkspaceClosed,
  WorkspaceCreated,
  WorkspaceDeleted,
  WorkspaceOpened,
  WorkspaceProjectAdded,
  WorkspaceProjectRemoved,
  WorkspaceRenamed,
  WorkspaceUpdated,
} from './WorkspaceEvents';
import type {
  WorkspaceArchivedPayload,
  WorkspaceClosedPayload,
  WorkspaceCreatedPayload,
  WorkspaceDeletedPayload,
  WorkspaceOpenedPayload,
  WorkspaceProjectAddedPayload,
  WorkspaceProjectRemovedPayload,
  WorkspaceRenamedPayload,
  WorkspaceUpdatedPayload,
} from './WorkspaceEvents';
import { FakeEventBus, FixedClock, SequenceIdGenerator } from './test_helpers';
import { WorkspaceFactory } from './WorkspaceFactory';
import { WorkspaceManager } from './WorkspaceManager';
import { WorkspaceRegistry } from './WorkspaceRegistry';

const asProjectId = (value: string): ProjectId => value as ProjectId;

const makeManager = (projectExists?: (id: ProjectId) => boolean) => {
  const bus = new FakeEventBus();
  const factory = new WorkspaceFactory({
    clock: new FixedClock(),
    idGenerator: new SequenceIdGenerator(),
  });
  const registry = new WorkspaceRegistry();
  const manager = new WorkspaceManager({ eventBus: bus, factory, registry, projectExists });
  return { bus, manager };
};

describe('WorkspaceManager — create', () => {
  it('creates, persists, and emits workspace.created with full payload', async () => {
    const { bus, manager } = makeManager();
    const workspace = await manager.create({ name: 'Nova Studio' });

    expect(workspace.status).toBe('draft');
    expect(manager.find(workspace.id)).toBe(workspace);

    const events = bus.emitted<WorkspaceCreatedPayload>(WorkspaceCreated.type);
    expect(events).toHaveLength(1);
    const payload = events[0];
    expect(payload?.workspaceId).toBe(workspace.id);
    expect(payload?.name).toBe('Nova Studio');
    expect(payload?.projectCount).toBe(0);
  });

  it('rejects an empty name with WorkspaceValidationError', async () => {
    const { manager } = makeManager();
    await expect(manager.create({ name: '   ' })).rejects.toMatchObject({
      name: 'WorkspaceValidationError',
    });
  });

  it('enforces name uniqueness via WorkspaceConflictError', async () => {
    const { manager } = makeManager();
    await manager.create({ name: 'Duplicate' });
    await expect(manager.create({ name: 'duplicate' })).rejects.toMatchObject({
      name: 'WorkspaceConflictError',
    });
  });
});

describe('WorkspaceManager — lifecycle', () => {
  const createDraft = async (manager: WorkspaceManager) =>
    manager.create({ name: 'Lifecycle WS' });

  it('opens draft → open and emits workspace.opened (idempotent)', async () => {
    const { bus, manager } = makeManager();
    const draft = await createDraft(manager);
    const opened = await manager.open(draft.id);
    expect(opened.status).toBe('open');
    expect(bus.emitted<WorkspaceOpenedPayload>(WorkspaceOpened.type)).toHaveLength(1);

    await manager.open(draft.id);
    expect(bus.emitted(WorkspaceOpened.type)).toHaveLength(1);
    expect(manager.get(draft.id).status).toBe('open');
  });

  it('closes open → closed and emits workspace.closed', async () => {
    const { bus, manager } = makeManager();
    const draft = await createDraft(manager);
    await manager.open(draft.id);
    const closed = await manager.close(draft.id);
    expect(closed.status).toBe('closed');
    const payload = bus.emitted<WorkspaceClosedPayload>(WorkspaceClosed.type)[0];
    expect(payload?.workspaceId).toBe(draft.id);
  });

  it('archives open → archived and emits workspace.archived', async () => {
    const { bus, manager } = makeManager();
    const draft = await createDraft(manager);
    const archived = await manager.archive(draft.id);
    expect(archived.status).toBe('archived');
    const payload = bus.emitted<WorkspaceArchivedPayload>(WorkspaceArchived.type);
    expect(payload).toHaveLength(1);
  });

  it('blocks closing a draft workspace (state guard)', async () => {
    const { manager } = makeManager();
    const draft = await createDraft(manager);
    await expect(manager.close(draft.id)).rejects.toMatchObject({
      name: 'WorkspaceStateError',
    });
  });

  it('blocks deleting an open workspace; allows deleting closed', async () => {
    const { bus, manager } = makeManager();
    const draft = await createDraft(manager);
    await manager.open(draft.id);
    await expect(manager.delete(draft.id)).rejects.toMatchObject({
      name: 'WorkspaceStateError',
    });

    await manager.close(draft.id);
    await manager.delete(draft.id);
    expect(bus.emitted<WorkspaceDeletedPayload>(WorkspaceDeleted.type)).toHaveLength(1);
    expect(manager.find(draft.id)).toBeUndefined();
  });
});

describe('WorkspaceManager — rename / update', () => {
  it('renames and emits workspace.renamed (+ updated when other fields change)', async () => {
    const { bus, manager } = makeManager();
    const ws = await manager.create({ name: 'Old Name' });
    const next = await manager.rename(ws.id, 'New Name', { description: 'updated' });

    expect(next.name).toBe('New Name');
    expect(next.description).toBe('updated');
    expect(bus.emitted<WorkspaceRenamedPayload>(WorkspaceRenamed.type)[0]?.previousName).toBe(
      'Old Name',
    );
    expect(bus.emitted<WorkspaceUpdatedPayload>(WorkspaceUpdated.type)[0]?.changedFields).toContain(
      'description',
    );
  });

  it('emits workspace.updated with changed fields and no event on empty patch', async () => {
    const { bus, manager } = makeManager();
    const ws = await manager.create({ name: 'WS' });
    const next = await manager.update(ws.id, { description: 'x' });
    expect(next.description).toBe('x');
    expect(bus.emitted<WorkspaceUpdatedPayload>(WorkspaceUpdated.type)[0]?.changedFields).toContain(
      'description',
    );

    const before = bus.publishCount;
    await manager.update(ws.id, {});
    expect(bus.publishCount).toBe(before);
  });
});

describe('WorkspaceManager — project ownership', () => {
  it('adds a project reference and emits workspace.project.added', async () => {
    const { bus, manager } = makeManager(() => true);
    const ws = await manager.create({ name: 'Owning WS' });
    const projectId = asProjectId('proj-1');
    const next = await manager.addProject(ws.id, projectId);

    expect(next.projectIds).toContain(projectId);
    const payload = bus.emitted<WorkspaceProjectAddedPayload>(WorkspaceProjectAdded.type)[0];
    expect(payload?.projectId).toBe(projectId);
    expect(payload?.workspaceId).toBe(ws.id);
    // Activity recorded for the ownership change.
    expect(manager.get(ws.id).activity.some((a) => a.kind === 'project.added')).toBe(true);
  });

  it('rejects adding an unknown project when a guard is installed', async () => {
    const { manager } = makeManager(() => false);
    const ws = await manager.create({ name: 'Guarded WS' });
    await expect(manager.addProject(ws.id, asProjectId('missing'))).rejects.toMatchObject({
      name: 'WorkspaceValidationError',
    });
  });

  it('rejects adding a project the workspace already owns', async () => {
    const { manager } = makeManager(() => true);
    const ws = await manager.create({ name: 'WS' });
    const projectId = asProjectId('proj-1');
    await manager.addProject(ws.id, projectId);
    await expect(manager.addProject(ws.id, projectId)).rejects.toMatchObject({
      name: 'WorkspaceOwnershipError',
    });
  });

  it('removes a project reference and emits workspace.project.removed', async () => {
    const { bus, manager } = makeManager(() => true);
    const ws = await manager.create({ name: 'WS' });
    const projectId = asProjectId('proj-1');
    const owned = await manager.addProject(ws.id, projectId);
    expect(owned.projectIds).toContain(projectId);

    const next = await manager.removeProject(ws.id, projectId);
    expect(next.projectIds).not.toContain(projectId);
    const payload = bus.emitted<WorkspaceProjectRemovedPayload>(WorkspaceProjectRemoved.type)[0];
    expect(payload?.projectId).toBe(projectId);
  });

  it('rejects removing a project the workspace does not own', async () => {
    const { manager } = makeManager(() => true);
    const ws = await manager.create({ name: 'WS' });
    await expect(manager.removeProject(ws.id, asProjectId('absent'))).rejects.toMatchObject({
      name: 'WorkspaceOwnershipError',
    });
  });
});

describe('WorkspaceRegistry', () => {
  it('stores, looks up by id and name, and enforces uniqueness', () => {
    const registry = new WorkspaceRegistry();
    const factory = new WorkspaceFactory({
      clock: new FixedClock(),
      idGenerator: new SequenceIdGenerator(),
    });
    const ws = factory.create({ name: 'Registry WS' });

    registry.add(ws);
    expect(registry.size).toBe(1);
    expect(registry.find(ws.id)).toBe(ws);
    expect(registry.findByName('registry ws')).toBe(ws);
    expect(registry.list()).toHaveLength(1);

    expect(() => registry.add(ws)).toThrow();
    expect(() => registry.add(factory.create({ name: 'Registry WS' }))).toThrow();

    registry.remove(ws.id);
    expect(registry.find(ws.id)).toBeUndefined();
  });
});

describe('WorkspaceFactory', () => {
  it('applies defaults (draft status, default theme, empty arrays)', () => {
    const factory = new WorkspaceFactory({
      clock: new FixedClock(),
      idGenerator: new SequenceIdGenerator(),
    });
    const ws = factory.create({ name: 'Defaults WS' });
    expect(ws.status).toBe('draft');
    expect(ws.theme).toEqual({ id: 'dark' });
    expect(ws.capabilities).toEqual([]);
    expect(ws.tools).toEqual([]);
    expect(ws.preferences).toEqual({});
  });

  it('bounds activity to ACTIVITY_LIMIT', () => {
    const factory = new WorkspaceFactory({
      clock: new FixedClock(),
      idGenerator: new SequenceIdGenerator(),
    });
    let ws = factory.create({ name: 'Activity WS' });
    for (let i = 0; i < 250; i++) {
      ws = factory.withActivity(ws, {
        id: `a-${i}`,
        kind: 'test',
        message: 'm',
        timestamp: 1 as Timestamp,
      });
    }
    expect(ws.activity.length).toBeLessThanOrEqual(200);
  });
});
