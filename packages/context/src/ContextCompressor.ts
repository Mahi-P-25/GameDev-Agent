import type { ContextItem } from './ContextPackage';
import type { CompressionConfig } from './ContextPolicy';
import { DEFAULT_COMPRESSION_CONFIG } from './ContextPolicy';

const ELLIPSIS = '...';

export interface CompressionResult {
  readonly items: ContextItem[];
  readonly originalTokens: number;
  readonly compressedTokens: number;
  readonly compressedCount: number;
}

export class ContextCompressor {
  private readonly defaultConfig: CompressionConfig;

  constructor(config: CompressionConfig = DEFAULT_COMPRESSION_CONFIG) {
    this.defaultConfig = config;
  }

  compress(items: readonly ContextItem[], config?: CompressionConfig): CompressionResult {
    const cfg = config ?? this.defaultConfig;
    let originalTokens = 0;
    let compressedTokens = 0;
    let compressedCount = 0;

    const result: ContextItem[] = [];

    for (const item of items) {
      originalTokens += item.tokens;

      if (!cfg.enabled || item.tokens <= cfg.maxItemTokens) {
        result.push(item);
        compressedTokens += item.tokens;
        continue;
      }

      const truncated = this.truncateToTokens(item.content, cfg.maxItemTokens);
      const newTokens = this.estimateTokens(truncated);

      result.push({
        ...item,
        content: truncated,
        tokens: newTokens,
        compressed: true,
        originalTokens: item.tokens,
      });

      compressedTokens += newTokens;
      compressedCount += 1;
    }

    return { items: result, originalTokens, compressedTokens, compressedCount };
  }

  private truncateToTokens(text: string, maxTokens: number): string {
    const charsPerToken = 4;
    const maxChars = maxTokens * charsPerToken;

    if (text.length <= maxChars) {
      return text;
    }

    const half = Math.floor((maxChars - ELLIPSIS.length) / 2);
    return text.slice(0, half) + ELLIPSIS + text.slice(text.length - half);
  }

  private estimateTokens(text: string): number {
    if (text.length === 0) {
      return 0;
    }
    return Math.max(1, Math.ceil(text.length / 4));
  }
}
