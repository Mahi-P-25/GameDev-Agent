import type { ModelRegistry as ModelRegistryInterface } from '../interfaces';
import type { Capability, ModelInfo, ProviderKind } from '../types';

export class ModelRegistry implements ModelRegistryInterface {
  private readonly models = new Map<string, ModelInfo>();

  register(model: ModelInfo): void {
    this.models.set(model.id, model);
  }

  resolve(modelId: string): ModelInfo | undefined {
    return this.models.get(modelId);
  }

  find(capabilities?: readonly Capability[]): readonly ModelInfo[] {
    const all = Array.from(this.models.values());
    if (capabilities === undefined || capabilities.length === 0) {
      return all;
    }
    const capSet = new Set(capabilities);
    return all.filter((m) => Array.from(capSet).every((c) => (m.capabilities as readonly Capability[]).includes(c)));
  }

  listByProvider(kind: ProviderKind): readonly ModelInfo[] {
    return Array.from(this.models.values()).filter((m) => m.provider === kind);
  }
}
