import { describe, expect, it } from 'vitest';
import {
  InMemoryMemoryProvider,
  MissionMemoryStore,
} from '@gamedev-agent/ami';
import type { MemoryRecord } from '@gamedev-agent/ami';

function record(overrides: Partial<MemoryRecord> & { id: string }): MemoryRecord {
  return {
    missionId: 'm1',
    projectId: 'p1',
    scope: 'mission',
    kind: 'fact',
    content: 'some fact',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('MissionMemoryStore — write + query', () => {
  it('delegates writes to the provider', async () => {
    const provider = new InMemoryMemoryProvider();
    const store = new MissionMemoryStore(provider);
    const r = record({ id: 'r1', kind: 'failure', content: 'boom' });
    await store.write(r);
    expect(provider.count()).toBe(1);
  });

  it('filters by mission, scope, kind, and goal node', async () => {
    const provider = new InMemoryMemoryProvider();
    const store = new MissionMemoryStore(provider);
    await store.write(record({ id: 'r1', missionId: 'm1', kind: 'failure', goalNodeId: 'g1' }));
    await store.write(record({ id: 'r2', missionId: 'm1', kind: 'success-pattern' }));
    await store.write(record({ id: 'r3', missionId: 'm2', kind: 'failure' }));

    expect((await store.query({ missionId: 'm1' })).length).toBe(2);
    expect((await store.query({ missionId: 'm1', kind: 'failure' })).map((r) => r.id)).toEqual(['r1']);
    expect((await store.query({ missionId: 'm1', goalNodeId: 'g1' })).map((r) => r.id)).toEqual(['r1']);
    expect((await store.query({ missionId: 'm2' })).map((r) => r.id)).toEqual(['r3']);
  });

  it('applies limit after ordering newest-first', async () => {
    const provider = new InMemoryMemoryProvider();
    const store = new MissionMemoryStore(provider);
    await store.write(record({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }));
    await store.write(record({ id: 'b', createdAt: '2026-01-02T00:00:00.000Z' }));
    await store.write(record({ id: 'c', createdAt: '2026-01-03T00:00:00.000Z' }));
    const result = await store.query({ missionId: 'm1', limit: 2 });
    expect(result.map((r) => r.id)).toEqual(['c', 'b']);
  });
});

describe('MissionMemoryStore — summarize', () => {
  it('concatenates the most recent N records', async () => {
    const provider = new InMemoryMemoryProvider();
    const store = new MissionMemoryStore(provider, 2);
    await store.write(record({ id: 'a', content: 'first', createdAt: '2026-01-01T00:00:00.000Z' }));
    await store.write(record({ id: 'b', content: 'second', createdAt: '2026-01-02T00:00:00.000Z' }));
    await store.write(record({ id: 'c', content: 'third', createdAt: '2026-01-03T00:00:00.000Z' }));
    const summary = await store.summarize('m1');
    expect(summary).toContain('third');
    expect(summary).toContain('second');
    expect(summary).not.toContain('first');
  });

  it('marks omitted records when more than the limit exist', async () => {
    const provider = new InMemoryMemoryProvider();
    const store = new MissionMemoryStore(provider, 2);
    for (let i = 0; i < 5; i++) {
      await store.write(
        record({ id: `r${i}`, content: `record ${i}`, createdAt: `2026-01-0${i + 1}T00:00:00.000Z` }),
      );
    }
    const summary = await store.summarize('m1');
    expect(summary).toContain('...3 earlier records omitted');
  });

  it('truncates long summaries with a clear marker', async () => {
    const provider = new InMemoryMemoryProvider();
    const store = new MissionMemoryStore(provider, 100, 50);
    await store.write(record({ id: 'a', content: 'x'.repeat(200) }));
    const summary = await store.summarize('m1');
    expect(summary.length).toBeLessThanOrEqual(50);
    expect(summary).toContain('...[summary truncated]');
  });

  it('does not add the omitted marker when nothing is omitted', async () => {
    const provider = new InMemoryMemoryProvider();
    const store = new MissionMemoryStore(provider, 10);
    await store.write(record({ id: 'a', content: 'hello' }));
    const summary = await store.summarize('m1');
    expect(summary).toContain('hello');
    expect(summary).not.toContain('omitted');
  });
});
