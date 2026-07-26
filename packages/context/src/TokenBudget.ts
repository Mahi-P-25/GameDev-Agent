import type { ContextItem } from './ContextPackage';
import { ContextBudgetExceededError } from './ContextPipelineErrors';
import type { BudgetConfig } from './ContextPolicy';
import { DEFAULT_BUDGET_CONFIG } from './ContextPolicy';

const DEFAULT_CHARS_PER_TOKEN = 4;

export class TokenEstimator {
  private readonly charsPerToken: number;

  constructor(charsPerToken: number = DEFAULT_CHARS_PER_TOKEN) {
    this.charsPerToken = charsPerToken;
  }

  estimate(text: string): number {
    if (text.length === 0) {
      return 0;
    }
    return Math.max(1, Math.ceil(text.length / this.charsPerToken));
  }

  estimateItems(items: readonly ContextItem[]): number {
    let total = 0;
    for (const item of items) {
      total += item.tokens;
    }
    return total;
  }
}

export interface BudgetResult {
  readonly items: ContextItem[];
  readonly evicted: ContextItem[];
  readonly totalTokens: number;
  readonly truncated: boolean;
}

export class TokenBudget {
  private readonly maxTokens: number;

  constructor(maxTokens = 128_000) {
    this.maxTokens = maxTokens;
  }

  allocate(
    items: ContextItem[],
    budget: number,
    config: BudgetConfig = DEFAULT_BUDGET_CONFIG,
  ): BudgetResult {
    if (budget > this.maxTokens) {
      throw new ContextBudgetExceededError(budget, this.maxTokens);
    }

    if (items.length === 0) {
      return { items: [], evicted: [], totalTokens: 0, truncated: false };
    }

    const reservedTokens = Math.min(
      Math.floor(budget * config.reservedRatio),
      config.maxReservedTokens,
    );

    const sorted = [...items].sort((a, b) => b.priority - a.priority);

    const reserved: ContextItem[] = [];
    const candidates: ContextItem[] = [];

    let reservedTotal = 0;
    for (const item of sorted) {
      if (reservedTotal + item.tokens <= reservedTokens) {
        reserved.push(item);
        reservedTotal += item.tokens;
      } else if (item.priority >= 0.8 && reservedTotal < reservedTokens) {
        reserved.push(item);
        reservedTotal += item.tokens;
      } else {
        candidates.push(item);
      }
    }

    const remaining = budget - reservedTotal;
    if (remaining <= 0) {
      return {
        items: reserved,
        evicted: candidates,
        totalTokens: reservedTotal,
        truncated: candidates.length > 0,
      };
    }

    candidates.sort((a, b) => b.relevance - a.relevance);

    const selected: ContextItem[] = [...reserved];
    let selectedTotal = reservedTotal;
    const evicted: ContextItem[] = [];

    for (const item of candidates) {
      if (selectedTotal + item.tokens <= remaining + reservedTokens) {
        selected.push(item);
        selectedTotal += item.tokens;
      } else {
        evicted.push(item);
      }
    }

    return {
      items: selected,
      evicted,
      totalTokens: selectedTotal,
      truncated: evicted.length > 0,
    };
  }
}
