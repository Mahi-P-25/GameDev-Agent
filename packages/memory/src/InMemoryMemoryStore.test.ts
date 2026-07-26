import { describe, expect, it } from 'vitest';
import { InMemoryMemoryStore } from './InMemoryMemoryStore';
import type { Timestamp } from '@gamedev-agent/shared';
import type { MemoryEntry, MemoryEntryInput, MemoryId } from './MemoryTypes';
import { FixedClock, SequenceIdGenerator } from './test_helpers';
import { MemoryFactory } from './MemoryFactory';

const clock = new FixedClock();
const idGen = new SequenceIdGenerator();
const factory = new MemoryFactory({ clock, idGenerator: idGen });

const makeEntry = (overrides?: Partial<MemoryEntryInput>): MemoryEntry => {
  return factory.create({
    tier: 'project',
    namespace: 'test/memory',
    category: 'note',
    content: { text: 'test' },
    summary: 'Test entry',
    provenance: { source: 'test', timestamp: 1_700_000_000_000 as Timestamp, actor: 'test' },
    ...overrides,
  });
};

describe('InMemoryMemoryStore', () => {
  it('stores and retrieves entries', async () => {
    const store = new InMemoryMemoryStore();
    const entry = makeEntry();

    await store.store(entry);
    const retrieved = await store.retrieve(entry.id);
    expect(retrieved?.id).toBe(entry.id);
    expect(retrieved?.summary).toBe('Test entry');
  });

  it('returns undefined for unknown id', async () => {
    const store = new InMemoryMemoryStore();
    const result = await store.retrieve('unknown' as MemoryId);
    expect(result).toBeUndefined();
  });

  it('updates existing entries', async () => {
    const store = new InMemoryMemoryStore();
    const entry = makeEntry();
    await store.store(entry);

    const updated = { ...entry, summary: 'Updated' };
    await store.update(updated);

    const retrieved = await store.retrieve(entry.id);
    expect(retrieved?.summary).toBe('Updated');
  });

  it('deletes entries', async () => {
    const store = new InMemoryMemoryStore();
    const entry = makeEntry();
    await store.store(entry);

    const deleted = await store.delete(entry.id);
    expect(deleted).toBe(true);

    const retrieved = await store.retrieve(entry.id);
    expect(retrieved).toBeUndefined();
  });

  it('returns false when deleting non-existent entry', async () => {
    const store = new InMemoryMemoryStore();
    const result = await store.delete('unknown' as MemoryId);
    expect(result).toBe(false);
  });

  it('queries by tier', async () => {
    const store = new InMemoryMemoryStore();
    await store.store(makeEntry({ tier: 'session', namespace: 's/test', summary: 'Session' }));
    await store.store(makeEntry({ tier: 'project', namespace: 'p/test', summary: 'Project' }));
    await store.store(makeEntry({ tier: 'session', namespace: 's/test2', summary: 'Session 2' }));

    const sessions = await store.query({ tier: 'session' });
    expect(sessions).toHaveLength(2);

    const projects = await store.query({ tier: 'project' });
    expect(projects).toHaveLength(1);
  });

  it('queries by namespace prefix', async () => {
    const store = new InMemoryMemoryStore();
    await store.store(makeEntry({ namespace: 'project-a/memory', summary: 'A' }));
    await store.store(makeEntry({ namespace: 'project-a/features', summary: 'B' }));
    await store.store(makeEntry({ namespace: 'project-b/memory', summary: 'C' }));

    const results = await store.query({ namespace: 'project-a' });
    expect(results).toHaveLength(2);
  });

  it('searches by text in summary and content', async () => {
    const store = new InMemoryMemoryStore();
    await store.store(makeEntry({ summary: 'Player jump height' }));
    await store.store(makeEntry({ summary: 'Enemy walk speed' }));

    const results = await store.search('jump');
    expect(results).toHaveLength(1);
    expect(results[0]?.entry.summary).toBe('Player jump height');
  });

  it('counts entries in a namespace', async () => {
    const store = new InMemoryMemoryStore();
    await store.store(makeEntry({ namespace: 'ns1/a', summary: 'A' }));
    await store.store(makeEntry({ namespace: 'ns1/b', summary: 'B' }));
    await store.store(makeEntry({ namespace: 'ns2/a', summary: 'C' }));

    const count = await store.count('ns1');
    expect(count).toBe(2);
  });

  it('lists entries by tier', async () => {
    const store = new InMemoryMemoryStore();
    await store.store(makeEntry({ tier: 'session', namespace: 's/t', summary: 'A' }));
    await store.store(makeEntry({ tier: 'session', namespace: 's/t', summary: 'B' }));

    const entries = await store.listByTier('session');
    expect(entries).toHaveLength(2);
  });

  it('clears all entries', async () => {
    const store = new InMemoryMemoryStore();
    await store.store(makeEntry({ summary: 'A' }));
    await store.store(makeEntry({ summary: 'B' }));

    await store.clear();
    const count = await store.count();
    expect(count).toBe(0);
  });

  it('clears entries by tier', async () => {
    const store = new InMemoryMemoryStore();
    await store.store(makeEntry({ tier: 'session', namespace: 's/t', summary: 'A' }));
    await store.store(makeEntry({ tier: 'project', namespace: 'p/t', summary: 'B' }));

    await store.clear('session');
    const count = await store.count();
    expect(count).toBe(1);
  });
});
