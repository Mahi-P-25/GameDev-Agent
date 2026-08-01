import type { VerificationStrategy } from '../interfaces';
import type { Observation, StrategyResult } from '../types';

/**
 * A strategy driven by an injected predicate function. Enables callers to plug
 * domain-specific checks (e.g. "rendered frame count >= 60") without extending
 * the engine — Open/Closed via registration. The predicate is injected at
 * construction time.
 */
export class CustomPredicateStrategy implements VerificationStrategy {
  readonly kind: string;

  constructor(
    kind: string,
    private readonly predicate: (
      observation: Observation,
      context?: Record<string, unknown>,
    ) => boolean | Promise<boolean>,
  ) {
    this.kind = kind;
  }

  async verify(
    observation: Observation,
    context?: Record<string, unknown>,
  ): Promise<StrategyResult> {
    const passed = await this.predicate(observation, context);
    return {
      strategyKind: this.kind,
      passed,
      detail: passed ? 'custom predicate satisfied' : 'custom predicate not satisfied',
    };
  }
}
