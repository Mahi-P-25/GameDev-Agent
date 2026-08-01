import type { IRetryStrategyResolver } from './interfaces';
import type { RetryPolicy } from './types';

/**
 * Default retry policy, applied whenever no specific policy exists for a
 * capability kind.
 */
export const DEFAULT_RETRY_POLICY: Readonly<RetryPolicy> = {
  maxAttempts: 3,
  backoffMs: 1000,
  backoffFactor: 2,
  escalateAfter: 2,
  alternateToolAllowed: true,
};

/**
 * Resolves retry policies per capability kind. Callers inject a policy map
 * keyed by capability kind; any kind without a policy falls back to
 * {@link DEFAULT_RETRY_POLICY}. Per-kind entries are `Partial<RetryPolicy>` so
 * a kind may override only the knobs it cares about (merged over the default).
 */
export class RetryStrategyResolver implements IRetryStrategyResolver {
  constructor(private readonly policies: Readonly<Record<string, Partial<RetryPolicy>>> = {}) {}

  resolve(capabilityKind: string): RetryPolicy {
    const policy = this.policies[capabilityKind];
    if (policy === undefined) {
      return { ...DEFAULT_RETRY_POLICY };
    }
    return { ...DEFAULT_RETRY_POLICY, ...policy };
  }
}
