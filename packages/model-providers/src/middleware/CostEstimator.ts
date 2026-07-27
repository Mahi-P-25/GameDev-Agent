import type { Middleware, MiddlewareContext, MiddlewareResult, NextMiddleware } from '../interfaces';
import type { ModelInfo } from '../types';
import { type CostEstimate, type TokenUsage } from '../types';

export class CostEstimator implements Middleware {
  readonly name = 'CostEstimator';

  async handle(context: MiddlewareContext, next: NextMiddleware): Promise<MiddlewareResult> {
    const result = await next(context);
    const modelInfo = context.provider.getModelInfo(result.response.model);

    if (modelInfo === undefined) {
      return result;
    }

    const cost = this.estimateCost(result.response.usage, modelInfo);
    return {
      response: { ...result.response, cost },
      context: result.context,
    };
  }

  private estimateCost(usage: TokenUsage, model: ModelInfo): CostEstimate {
    const promptCost = (usage.promptTokens / 1_000_000) * model.pricing.promptPerMillion;
    const completionCost = (usage.completionTokens / 1_000_000) * model.pricing.completionPerMillion;
    return {
      currency: 'USD',
      promptCost: roundCents(promptCost),
      completionCost: roundCents(completionCost),
      totalCost: roundCents(promptCost + completionCost),
    };
  }
}

function roundCents(value: number): number {
  return Math.round(value * 100_000) / 100_000;
}
