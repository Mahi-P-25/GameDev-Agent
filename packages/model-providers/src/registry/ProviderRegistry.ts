import type { ProviderFactory, ProviderRegistry as ProviderRegistryInterface } from '../interfaces';
import type { ModelProvider } from '../interfaces';
import type { ProviderConfig, ProviderKind } from '../types';
import { ModelConfigurationError } from '../types';

export class ProviderRegistry implements ProviderRegistryInterface {
  private readonly factories = new Map<ProviderKind, ProviderFactory>();

  register(factory: ProviderFactory): void {
    this.factories.set(factory.kind, factory);
  }

  create(kind: ProviderKind, config: ProviderConfig): ModelProvider {
    const factory = this.factories.get(kind);
    if (factory === undefined) {
      throw new ModelConfigurationError(`No factory registered for provider kind: ${kind}`);
    }
    return factory.createProvider(config);
  }

  has(kind: ProviderKind): boolean {
    return this.factories.has(kind);
  }

  listKinds(): readonly ProviderKind[] {
    return Array.from(this.factories.keys());
  }
}
