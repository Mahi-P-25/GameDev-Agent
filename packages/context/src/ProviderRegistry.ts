import type { ContextSourceName } from './ContextPackage';
import type { ContextProvider } from './ContextProvider';

export class ProviderRegistry {
  private readonly providers = new Map<string, ContextProvider>();

  get size(): number {
    return this.providers.size;
  }

  register(provider: ContextProvider): void {
    this.providers.set(provider.metadata.sourceName, provider);
  }

  unregister(sourceName: ContextSourceName): void {
    this.providers.delete(sourceName);
  }

  get(sourceName: ContextSourceName): ContextProvider | undefined {
    return this.providers.get(sourceName);
  }

  has(sourceName: ContextSourceName): boolean {
    return this.providers.has(sourceName);
  }

  all(): readonly ContextProvider[] {
    return [...this.providers.values()];
  }

  getBySourceType(sourceType: 'internal' | 'external'): readonly ContextProvider[] {
    const result: ContextProvider[] = [];
    for (const provider of this.providers.values()) {
      if (provider.metadata.sourceType === sourceType) {
        result.push(provider);
      }
    }
    return result;
  }

  clear(): void {
    this.providers.clear();
  }
}
