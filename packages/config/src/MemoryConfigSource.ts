import { ConfigNotFoundError } from './errors';
import type { ConfigSource } from './index';

/**
 * Built-in configuration source backed by an in-memory map.
 *
 * It is the kernel's default `ConfigSource` so the kernel is self-bootstrapping
 * before file/env/remote sources (provided as modules) are registered. `set`
 * exists for runtime configuration injection and tests.
 */
export class MemoryConfigSource implements ConfigSource {
  readonly name = 'memory';
  private readonly store = new Map<string, unknown>();

  constructor(initial?: Readonly<Record<string, unknown>>) {
    if (initial !== undefined) {
      for (const [key, value] of Object.entries(initial)) {
        this.store.set(key, value);
      }
    }
  }

  has(path: string): boolean {
    return this.store.has(path);
  }

  async load<T>(path: string): Promise<T> {
    if (!this.store.has(path)) {
      throw new ConfigNotFoundError(path);
    }
    return cloneJson(this.store.get(path)) as T;
  }

  set(path: string, value: unknown): void {
    this.store.set(path, value);
  }

  delete(path: string): boolean {
    return this.store.delete(path);
  }
}

/**
 * Config values are `Json`, so a JSON round-trip is a safe deep clone that
 * prevents external callers from mutating the stored source object.
 */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
