import { randomUUID } from 'node:crypto';
import type { IVerificationEngine, VerificationStrategy } from './interfaces';
import type { Observation, StrategyResult, VerificationResult } from './types';

export interface VerificationEngineOptions {
  /**
   * Aggregation mode. `all-must-pass` (default) requires every registered
   * strategy to pass; `weighted-threshold` passes when the fraction of
   * satisfied strategy weight reaches `threshold` (default 0.8). The mode is
   * a constructor option — it is not hardcoded.
   */
  readonly mode?: 'all-must-pass' | 'weighted-threshold';
  readonly threshold?: number;
}

/**
 * Verifies observations by dispatching to a registry of {@link VerificationStrategy}
 * implementations keyed by `kind`. Strategies are registered at construction
 * time via `registerStrategy` — dispatch is a registry lookup, never a switch
 * statement (Open/Closed).
 */
export class VerificationEngine implements IVerificationEngine {
  private readonly strategies = new Map<string, VerificationStrategy>();
  private readonly weights = new Map<string, number>();
  private readonly mode: 'all-must-pass' | 'weighted-threshold';
  private readonly threshold: number;

  constructor(options: VerificationEngineOptions = {}) {
    this.mode = options.mode ?? 'all-must-pass';
    this.threshold = options.threshold ?? 0.8;
  }

  registerStrategy(strategy: VerificationStrategy, weight = 1): void {
    this.strategies.set(strategy.kind, strategy);
    this.weights.set(strategy.kind, weight);
  }

  async verify(observation: Observation): Promise<VerificationResult> {
    const strategyResults: StrategyResult[] = [];
    for (const strategy of this.strategies.values()) {
      strategyResults.push(await strategy.verify(observation));
    }

    const status =
      strategyResults.length === 0
        ? 'inconclusive'
        : this.mode === 'all-must-pass'
          ? this.aggregateAllMustPass(strategyResults)
          : this.aggregateWeighted(strategyResults);

    const evidence: Record<string, unknown> = {
      mode: this.mode,
      strategyCount: strategyResults.length,
      passedCount: strategyResults.filter((r) => r.passed).length,
    };

    return {
      id: randomUUID(),
      observationId: observation.id,
      status,
      evidence,
      strategyResults,
    };
  }

  private aggregateAllMustPass(results: readonly StrategyResult[]): VerificationResult['status'] {
    if (results.every((r) => r.passed)) return 'passed';
    if (results.some((r) => r.passed)) return 'partial';
    return 'failed';
  }

  private aggregateWeighted(results: readonly StrategyResult[]): VerificationResult['status'] {
    let total = 0;
    let earned = 0;
    for (const r of results) {
      const weight = this.weights.get(r.strategyKind) ?? 1;
      total += weight;
      if (r.passed) earned += weight;
    }
    if (total === 0) return 'inconclusive';
    const ratio = earned / total;
    if (ratio >= this.threshold) return ratio === 1 ? 'passed' : 'partial';
    return 'failed';
  }
}
