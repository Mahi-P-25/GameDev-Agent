import type { Logger } from '@gamedev-agent/logging';
import type { Json } from '@gamedev-agent/shared';
import { ConfigNotFoundError } from './errors';
import type { ConfigSchema, ConfigSource, ResolvedConfig } from './index';

/**
 * Aggregates multiple {@link ConfigSource}s behind a single `ConfigSource`
 * contract and adds typed, schema-driven resolution.
 *
 * Sources are consulted in registration order (first match wins), so later,
 * higher-priority sources (e.g. env overrides) shadow earlier ones. `resolve`
 * validates raw `Json` through a {@link ConfigSchema} and records provenance
 * so the Memory Kernel can trace any setting back to its origin.
 */
export class ConfigurationService implements ConfigSource {
  readonly name = 'configuration';
  private readonly sources = new Map<string, ConfigSource>();

  constructor(
    sourceList: ReadonlyArray<ConfigSource>,
    private readonly _logger?: Logger,
  ) {
    for (const source of sourceList) {
      this.sources.set(source.name, source);
    }
  }

  get sourceList(): ReadonlyArray<ConfigSource> {
    return [...this.sources.values()];
  }

  has(path: string): boolean {
    for (const source of this.sources.values()) {
      if (source.has(path)) {
        return true;
      }
    }
    return false;
  }

  async load<T>(path: string): Promise<T> {
    for (const source of this.sources.values()) {
      if (source.has(path)) {
        this._logger?.debug('config.loaded', { path, source: source.name });
        return source.load<T>(path);
      }
    }
    throw new ConfigNotFoundError(path);
  }

  async resolve<T>(schema: ConfigSchema<T>): Promise<ResolvedConfig<T>> {
    const raw = await this.load<Json>(schema.id);
    const value = schema.parse(raw);

    let sourceName = 'unknown';
    for (const source of this.sources.values()) {
      if (source.has(schema.id)) {
        sourceName = source.name;
        break;
      }
    }

    return { schema, value, source: sourceName };
  }
}
