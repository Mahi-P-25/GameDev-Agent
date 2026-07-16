import type { Json } from '@gamedev-agent/shared';

/**
 * A named, loadable origin of configuration (file, env, remote store, …).
 * Implementations are provided by plugins; this is the contract only.
 */
export interface ConfigSource {
  readonly name: string;
  has(path: string): boolean;
  load<T>(path: string): Promise<T>;
}

/**
 * Strongly-typed configuration schema. `parse` is the single place where raw
 * `Json` is validated and shaped into a typed value.
 */
export interface ConfigSchema<T> {
  readonly id: string;
  readonly parse: (raw: Json) => T;
}

/**
 * A fully resolved configuration: the typed value plus provenance so the
 * Memory Kernel can trace where a setting originated.
 */
export interface ResolvedConfig<T> {
  readonly schema: ConfigSchema<T>;
  readonly value: T;
  readonly source: string;
}

// Reference implementations (kernel defaults).
export { ConfigurationService } from './ConfigurationService';
export { MemoryConfigSource } from './MemoryConfigSource';
export { ConfigNotFoundError } from './errors';
