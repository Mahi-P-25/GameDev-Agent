import type { ProjectId } from '@gamedev-agent/project';
import type { Disposable } from '@gamedev-agent/shared';
import type { FileDelta, FileIndex, IndexedSnapshot, ProjectFingerprint } from '../types';

export interface ProjectIndexCacheOptions {
  /** Content hash function used for fingerprints. Defaults to FNV-1a. */
  readonly hasher?: (content: string) => string;
}

/**
 * Project Index Cache.
 *
 * Stores one {@link IndexedSnapshot} per project and supports incremental
 * updates: {@link syncFiles} diffs a fresh scan against the cached fingerprint
 * and reports exactly which files were added/changed/removed/unchanged, so
 * callers can skip re-analysis entirely when nothing changed.
 *
 * The cache is content-addressed (path → content hash) because the Filesystem
 * tool seam does not expose modification times; unchanged content is therefore
 * recognizable without trusting any clock.
 */
export class ProjectIndexCache<TContext> implements Disposable {
  private readonly store = new Map<string, IndexedSnapshot<TContext>>();
  private readonly hasher: (content: string) => string;
  private disposed = false;

  constructor(options?: ProjectIndexCacheOptions) {
    this.hasher = options?.hasher ?? fnv1a;
  }

  /** The cached snapshot for a project, or `null`. */
  get(projectId: ProjectId): IndexedSnapshot<TContext> | null {
    return this.store.get(String(projectId)) ?? null;
  }

  has(projectId: ProjectId): boolean {
    return this.store.has(String(projectId));
  }

  /** Build and store a snapshot from a fresh scan. */
  capture(
    projectId: ProjectId,
    rootPath: string,
    files: FileIndex,
    context: TContext,
  ): IndexedSnapshot<TContext> {
    const snapshot: IndexedSnapshot<TContext> = {
      rootPath,
      fingerprint: this.fingerprint(files),
      context,
      updatedAt: Date.now(),
    };
    this.store.set(String(projectId), snapshot);
    return snapshot;
  }

  remove(projectId: ProjectId): void {
    this.store.delete(String(projectId));
  }

  clear(): void {
    this.store.clear();
  }

  /** Compute the content fingerprint of a file index. */
  fingerprint(files: FileIndex): ProjectFingerprint {
    const paths = Object.keys(files).sort();
    const hashes: Record<string, string> = {};
    let totalBytes = 0;
    for (const path of paths) {
      const content = files[path] ?? '';
      hashes[path] = this.hasher(content);
      totalBytes += content.length;
    }
    return { paths, hashes, totalBytes };
  }

  /**
   * Diff a fresh scan against the cached fingerprint for a project. When no
   * snapshot exists yet, every file is reported as `added`.
   */
  syncFiles(projectId: ProjectId, files: FileIndex): FileDelta {
    const snapshot = this.store.get(String(projectId));
    const incoming = Object.keys(files);
    if (snapshot === undefined) {
      return {
        added: incoming,
        changed: [],
        removed: [],
        unchanged: [],
        changedCount: incoming.length,
      };
    }

    const cachedPaths = new Set(snapshot.fingerprint.paths);
    const cachedHashes = snapshot.fingerprint.hashes;
    const added: string[] = [];
    const changed: string[] = [];
    const unchanged: string[] = [];

    for (const path of incoming) {
      const hash = this.hasher(files[path] ?? '');
      if (!cachedPaths.has(path)) {
        added.push(path);
      } else if (cachedHashes[path] !== hash) {
        changed.push(path);
      } else {
        unchanged.push(path);
      }
    }

    const removed: string[] = [];
    for (const path of snapshot.fingerprint.paths) {
      if (!Object.prototype.hasOwnProperty.call(files, path)) {
        removed.push(path);
      }
    }

    return {
      added,
      changed,
      removed,
      unchanged,
      changedCount: added.length + changed.length + removed.length,
    };
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.store.clear();
  }
}

/** Deterministic FNV-1a hash — stable across platforms, no crypto dependency. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
