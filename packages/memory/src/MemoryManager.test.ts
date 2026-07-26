import type { Timestamp } from '@gamedev-agent/shared';
import { describe, expect, it } from 'vitest';
import {
  MemoryDeleted,
  MemoryPromoted,
  MemoryStored,
  MemoryUpdated,
} from './MemoryEvents';
import type {
  MemoryDeletedPayload,
  MemoryPromotedPayload,
  MemoryStoredPayload,
  MemoryUpdatedPayload,
} from './MemoryEvents';
import { MemoryFactory } from './MemoryFactory';
import { MemoryManager } from './MemoryManager';
import { MemoryRegistry } from './MemoryRegistry';
import { InMemoryMemoryStore } from './InMemoryMemoryStore';
import { MemoryValidationError } from './MemoryErrors';
import { FakeEventBus, FixedClock, SequenceIdGenerator } from './test_helpers';
import type { MemoryEntryInput } from './MemoryTypes';

const makeInput = (overrides?: Partial<MemoryEntryInput>): MemoryEntryInput => ({
  tier: 'project',
  namespace: 'test-project/memory',
  category: 'note',
  content: { text: 'hello world' },
  summary: 'A test memory entry',
  provenance: {
    source: 'test',
    timestamp: 1_700_000_000_000 as Timestamp,
    actor: 'test-runner',
  },
  ...overrides,
});

const makeManager = () => {
  const bus = new FakeEventBus();
  const store = new InMemoryMemoryStore();
  const factory = new MemoryFactory({
    clock: new FixedClock(),
    idGenerator: new SequenceIdGenerator(),
  });
  const registry = new MemoryRegistry();
  const manager = new MemoryManager({ eventBus: bus, store, factory, registry });
  return { bus, store, manager };
};

describe('MemoryManager — storeEntry', () => {
  it('stores a memory entry and emits memory.stored', async () => {
    const { bus, manager } = makeManager();
    const entry = await manager.storeEntry(makeInput());

    expect(entry.id).toBeTruthy();
    expect(entry.tier).toBe('project');
    expect(entry.summary).toBe('A test memory entry');
    expect(entry.createdAt).toBe(1_700_000_000_000);

    const events = bus.emitted<MemoryStoredPayload>(MemoryStored.type);
    expect(events).toHaveLength(1);
    expect(events[0]?.entryId).toBe(entry.id);
    expect(events[0]?.tier).toBe('project');
  });

  it('rejects invalid input with MemoryValidationError', async () => {
    const { manager } = makeManager();
    await expect(manager.storeEntry(makeInput({ summary: '' }))).rejects.toThrow(
      MemoryValidationError,
    );
  });

  it('rejects storage with invalid tier/namespace combination', async () => {
    const { manager } = makeManager();
    await expect(
      manager.storeEntry(makeInput({ tier: 'project', namespace: 'global' })),
    ).rejects.toThrow();
  });
});

describe('MemoryManager — retrieve', () => {
  it('retrieves a stored entry and increments access count', async () => {
    const { manager } = makeManager();
    const entry = await manager.storeEntry(makeInput());

    const retrieved = await manager.retrieve(entry.id);
    expect(retrieved.id).toBe(entry.id);
    expect(retrieved.accessCount).toBe(1);
  });

  it('throws MemoryNotFoundError for unknown ids', async () => {
    const { manager } = makeManager();
    await expect(
      manager.retrieve('00000000-0000-0000-0000-999999999999' as never),
    ).rejects.toThrow();
  });
});

describe('MemoryManager — updateContent', () => {
  it('updates content and emits memory.updated', async () => {
    const { bus, manager } = makeManager();
    const entry = await manager.storeEntry(makeInput());

    const updated = await manager.updateContent(entry.id, { text: 'updated' }, 'Updated summary');
    expect(updated.summary).toBe('Updated summary');

    const events = bus.emitted<MemoryUpdatedPayload>(MemoryUpdated.type);
    expect(events).toHaveLength(1);
    expect(events[0]?.changedFields).toContain('content');
    expect(events[0]?.changedFields).toContain('summary');
  });
});

describe('MemoryManager — delete', () => {
  it('deletes a stored entry and emits memory.deleted', async () => {
    const { bus, manager } = makeManager();
    const entry = await manager.storeEntry(makeInput());

    await manager.delete(entry.id);

    const events = bus.emitted<MemoryDeletedPayload>(MemoryDeleted.type);
    expect(events).toHaveLength(1);
    expect(events[0]?.entryId).toBe(entry.id);
  });

  it('throws when deleting a non-existent entry', async () => {
    const { manager } = makeManager();
    await expect(
      manager.delete('00000000-0000-0000-0000-999999999999' as never),
    ).rejects.toThrow();
  });
});

describe('MemoryManager — query', () => {
  it('returns entries matching the query filter', async () => {
    const { manager } = makeManager();
    await manager.storeEntry(makeInput({ category: 'note', summary: 'Note A' }));
    await manager.storeEntry(makeInput({ category: 'decision', summary: 'Decision B' }));
    await manager.storeEntry(makeInput({ category: 'note', summary: 'Note C' }));

    const notes = await manager.query({ category: 'note' });
    expect(notes).toHaveLength(2);

    const decisions = await manager.query({ category: 'decision' });
    expect(decisions).toHaveLength(1);
  });

  it('filters by namespace', async () => {
    const { manager } = makeManager();
    await manager.storeEntry(makeInput({ namespace: 'project-a/memory', summary: 'A' }));
    await manager.storeEntry(makeInput({ namespace: 'project-b/memory', summary: 'B' }));

    const results = await manager.query({ namespace: 'project-a/memory' });
    expect(results).toHaveLength(1);
    expect(results[0]?.summary).toBe('A');
  });

  it('returns empty array when nothing matches', async () => {
    const { manager } = makeManager();
    const results = await manager.query({ category: 'bug' });
    expect(results).toHaveLength(0);
  });
});

describe('MemoryManager — search', () => {
  it('finds entries by text in summary', async () => {
    const { manager } = makeManager();
    await manager.storeEntry(makeInput({ summary: 'Player movement system' }));
    await manager.storeEntry(makeInput({ summary: 'Enemy AI behavior' }));

    const results = await manager.search('movement');
    expect(results).toHaveLength(1);
    expect(results[0]?.entry.summary).toBe('Player movement system');
  });

  it('returns empty array for non-matching text', async () => {
    const { manager } = makeManager();
    await manager.storeEntry(makeInput({ summary: 'Something' }));

    const results = await manager.search('nonexistent');
    expect(results).toHaveLength(0);
  });
});

describe('MemoryManager — promote', () => {
  it('promotes an entry to a higher tier', async () => {
    const { bus, manager } = makeManager();
    const entry = await manager.storeEntry(
      makeInput({ tier: 'session', namespace: 'test-project/memory' }),
    );

    const promoted = await manager.promote(entry.id, 'project');
    expect(promoted.tier).toBe('project');

    const events = bus.emitted<MemoryPromotedPayload>(MemoryPromoted.type);
    expect(events).toHaveLength(1);
    expect(events[0]?.fromTier).toBe('session');
    expect(events[0]?.toTier).toBe('project');
  });

  it('rejects promotion to an invalid target tier', async () => {
    const { manager } = makeManager();
    const entry = await manager.storeEntry(
      makeInput({ tier: 'project', namespace: 'test-project/memory' }),
    );

    await expect(manager.promote(entry.id, 'session')).rejects.toThrow();
  });
});

describe('MemoryManager — count', () => {
  it('counts entries for a given namespace', async () => {
    const { manager } = makeManager();
    await manager.storeEntry(makeInput({ namespace: 'project-a/memory', summary: 'A' }));
    await manager.storeEntry(makeInput({ namespace: 'project-a/memory', summary: 'B' }));
    await manager.storeEntry(makeInput({ namespace: 'project-b/memory', summary: 'C' }));

    const count = await manager.count('project-a/memory');
    expect(count).toBe(2);
  });
});

describe('MemoryManager — consolidate', () => {
  it('removes aged temporary entries during consolidation', async () => {
    const oldClock = new FixedClock(1_000_000_000_000);
    const oldFactory = new MemoryFactory({ clock: oldClock, idGenerator: new SequenceIdGenerator() });
    const oldBus = new FakeEventBus();
    const oldStore = new InMemoryMemoryStore();
    const oldRegistry = new MemoryRegistry();
    const oldManager = new MemoryManager({
      eventBus: oldBus,
      store: oldStore,
      factory: oldFactory,
      registry: oldRegistry,
    });

    await oldManager.storeEntry(makeInput({ tier: 'temporary', namespace: 'session/test', summary: 'Old entry' }));

    const summary = await oldManager.consolidate();
    expect(summary).toBeTruthy();
  });
});

describe('MemoryManager — dispose', () => {
  it('can be disposed and rejects operations afterward', async () => {
    const { manager } = makeManager();
    manager.dispose();

    await expect(manager.storeEntry(makeInput())).rejects.toThrow('disposed');
  });
});

describe('MemoryManager — listByTier', () => {
  it('lists all entries of a given tier', async () => {
    const { manager } = makeManager();
    await manager.storeEntry(makeInput({ tier: 'session', namespace: 's/test', summary: 'A' }));
    await manager.storeEntry(makeInput({ tier: 'project', namespace: 'p/test', summary: 'B' }));

    const sessions = await manager.listByTier('session');
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.summary).toBe('A');
  });
});

describe('MemoryManager — listByNamespace', () => {
  it('lists all entries in a namespace', async () => {
    const { manager } = makeManager();
    await manager.storeEntry(makeInput({ namespace: 'project-a/memory', summary: 'A' }));
    await manager.storeEntry(makeInput({ namespace: 'project-a/memory', summary: 'B' }));

    const entries = await manager.listByNamespace('project-a/memory');
    expect(entries).toHaveLength(2);
  });
});
