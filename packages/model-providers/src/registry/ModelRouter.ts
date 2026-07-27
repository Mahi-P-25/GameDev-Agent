import type { ModelRegistry, ModelRouter as ModelRouterInterface } from '../interfaces';
import type { ModelInfo, RoutingContext, RoutingDecision } from '../types';

export class ModelRouter implements ModelRouterInterface {
  constructor(
    private readonly modelRegistry: ModelRegistry,
    private readonly defaultProviderKind?: string,
    private readonly defaultModel?: string,
  ) {}

  async decide(context: RoutingContext): Promise<RoutingDecision> {
    const { request, capabilities, priority } = context;

    if (request.model !== undefined) {
      const modelInfo = this.modelRegistry.resolve(request.model);
      if (modelInfo !== undefined) {
        return {
          provider: modelInfo.provider,
          model: modelInfo.id,
          reason: `explicit model requested: ${request.model}`,
        };
      }
    }

    const candidates = this.modelRegistry.find(capabilities);
    if (candidates.length === 0) {
      return {
        provider: this.defaultProviderKind as any,
        model: this.defaultModel ?? '',
        reason: 'fallback to default',
      };
    }

    if (priority === 'high' && candidates.length > 1) {
      const sorted = [...candidates].sort((a, b) => {
        const aCost = a.pricing.promptPerMillion + a.pricing.completionPerMillion;
        const bCost = b.pricing.promptPerMillion + b.pricing.completionPerMillion;
        return aCost - bCost;
      });
      const best = sorted[0] as ModelInfo;
      return {
        provider: best.provider,
        model: best.id,
        reason: `lowest cost among ${candidates.length} candidates matching capabilities`,
      };
    }

    const selected = candidates[0] as ModelInfo;
    return {
      provider: selected.provider,
      model: selected.id,
      reason: `first of ${candidates.length} candidates matching capabilities`,
    };
  }
}
