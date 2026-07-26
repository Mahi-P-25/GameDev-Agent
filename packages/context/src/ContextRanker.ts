import type { Timestamp } from '@gamedev-agent/shared';
import type { ContextItem } from './ContextPackage';
import type { RankingWeights } from './ContextPolicy';
import { DEFAULT_RANKING_WEIGHTS } from './ContextPolicy';
import type { ContextRequest } from './ContextRequest';

const MS_IN_DAY = 86_400_000;
const DECAY_LAMBDA = Math.LN2 / MS_IN_DAY;

export class ContextRanker {
  rank(
    items: readonly ContextItem[],
    request: ContextRequest,
    weights: RankingWeights = DEFAULT_RANKING_WEIGHTS,
  ): ContextItem[] {
    const now = Date.now() as Timestamp;

    const scored = items.map((item) => {
      const recencyScore = this.computeRecency(item, now);
      const priorityScore = this.computePriority(item);
      const alignmentScore = this.computeAlignment(item, request);
      const freshnessScore = this.computeFreshness(item);

      const relevance =
        weights.recency * recencyScore +
        weights.sourcePriority * priorityScore +
        weights.alignment * alignmentScore +
        weights.freshness * freshnessScore;

      return { ...item, relevance };
    });

    scored.sort((a, b) => b.relevance - a.relevance);
    return scored;
  }

  private computeRecency(item: ContextItem, now: Timestamp): number {
    const age = Number(now) - Number(item.attribution.timestamp);
    if (age < 0) {
      return 1;
    }
    return Math.exp(-DECAY_LAMBDA * age);
  }

  private computePriority(item: ContextItem): number {
    return Math.min(1, Math.max(0, item.priority));
  }

  private computeAlignment(item: ContextItem, request: ContextRequest): number {
    const query = request.query;
    if (query === undefined || query.length === 0) {
      return 0.5;
    }

    const queryTerms = this.tokenize(query);
    if (queryTerms.length === 0) {
      return 0.5;
    }

    const contentTerms = this.tokenize(item.content);
    if (contentTerms.length === 0) {
      return 0;
    }

    const contentSet = new Set(contentTerms);
    let matchCount = 0;
    for (const term of queryTerms) {
      if (contentSet.has(term)) {
        matchCount += 1;
      }
    }

    return matchCount / queryTerms.length;
  }

  private computeFreshness(item: ContextItem): number {
    const inclusionHints = item.metadata.inclusionCount;
    if (typeof inclusionHints === 'number') {
      return Math.max(0, 1 - inclusionHints / 5);
    }
    const hasDedupKey = item.dedupKey !== undefined && item.dedupKey !== null;
    if (hasDedupKey) {
      return 0.9;
    }
    return 1;
  }

  private tokenize(text: string): string[] {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '');
    return cleaned.split(/\s+/).filter((t) => t.length > 2 && t.length < 50);
  }
}
