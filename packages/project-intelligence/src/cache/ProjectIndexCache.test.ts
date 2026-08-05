import type { ProjectId } from '@gamedev-agent/project';
import { describe, expect, it } from 'vitest';
import type { FileIndex } from '../types';
import { ProjectIndexCache } from './ProjectIndexCache';

const PID = 'p1' as ProjectId;

const FILES_A: FileIndex = {
  'package.json': '{"name": "a"}',
  'src/index.ts': 'export const a = 1;',
};

const FILES_B: FileIndex = {
  ...FILES_A,
  'src/util.ts': 'export const util = () => {};',
};

describe('ProjectIndexCache', () => {
  it('reports every file as added on the first sync', () => {
    const cache = new ProjectIndexCache<unknown>();
    const delta = cache.syncFiles(PID, FILES_A);
    expect([...delta.added].sort()).toEqual(['package.json', 'src/index.ts']);
    expect(delta.changed).toEqual([]);
    expect(delta.removed).toEqual([]);
    expect(delta.changedCount).toBe(2);
  });

  it('reports unchanged files on an identical re-scan', () => {
    const cache = new ProjectIndexCache<unknown>();
    cache.capture(PID, '/repo', FILES_A, {});
    const delta = cache.syncFiles(PID, FILES_A);
    expect([...delta.unchanged].sort()).toEqual(['package.json', 'src/index.ts']);
    expect(delta.added).toEqual([]);
    expect(delta.changed).toEqual([]);
    expect(delta.changedCount).toBe(0);
  });

  it('detects changed, added, and removed files incrementally', () => {
    const cache = new ProjectIndexCache<unknown>();
    cache.capture(PID, '/repo', FILES_B, {});

    const next: FileIndex = {
      'package.json': '{"name": "a"}',
      'src/index.ts': 'export const a = 2;',
      'src/new.ts': 'export const n = 1;',
    };

    const delta = cache.syncFiles(PID, next);
    expect(delta.unchanged).toEqual(['package.json']);
    expect(delta.changed).toEqual(['src/index.ts']);
    expect(delta.added).toEqual(['src/new.ts']);
    expect(delta.removed).toEqual(['src/util.ts']);
    expect(delta.changedCount).toBe(3);
  });

  it('fingerprints are stable and change with content', () => {
    const cache = new ProjectIndexCache<unknown>();
    const first = cache.fingerprint(FILES_A);
    const second = cache.fingerprint(FILES_A);
    expect(first).toEqual(second);

    const changed = cache.fingerprint({ ...FILES_A, 'src/index.ts': 'export const a = 2;' });
    expect(changed.hashes['src/index.ts']).not.toBe(first.hashes['src/index.ts']);
  });

  it('captures snapshots and supports get/has/remove/dispose', () => {
    const cache = new ProjectIndexCache<unknown>();
    expect(cache.has(PID)).toBe(false);

    cache.capture(PID, '/repo', FILES_A, { token: 1 });
    expect(cache.has(PID)).toBe(true);
    expect(cache.get(PID)?.rootPath).toBe('/repo');
    expect(cache.get(PID)?.context).toEqual({ token: 1 });
    expect(cache.get(PID)?.fingerprint.paths).toHaveLength(2);

    cache.remove(PID);
    expect(cache.has(PID)).toBe(false);

    cache.capture(PID, '/repo', FILES_A, { token: 2 });
    cache.dispose();
    expect(cache.has(PID)).toBe(false);
  });
});
