import type { ContextItem, ContextSourceName } from './ContextPackage';
import type { ContextRequest } from './ContextRequest';
import type { CurrentContext } from './ContextTypes';

export type SourceType = 'internal' | 'external';

export interface ProviderMetadata {
  readonly sourceName: ContextSourceName;
  readonly priority: number;
  readonly latency: 'instant' | 'fast' | 'medium' | 'slow';
  readonly estimatedTokens: number;
  readonly freshness: 'volatile' | 'session' | 'persistent' | 'static';
  readonly cost: 'free' | 'low' | 'medium' | 'high';
  readonly sourceType: SourceType;
  readonly description: string;
}

export interface AssemblyContext {
  readonly request: ContextRequest;
  readonly currentContext: CurrentContext;
}

export interface ContextProvider {
  readonly metadata: ProviderMetadata;
  collect(context: AssemblyContext): Promise<readonly ContextItem[]>;
}
