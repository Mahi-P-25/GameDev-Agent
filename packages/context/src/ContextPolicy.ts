import type { AgentRole } from './ContextRequest';

export interface ProviderPolicyConfig {
  readonly enabled: boolean;
  readonly maxItems?: number;
  readonly maxTokens?: number;
  readonly priorityOverride?: number;
}

export interface RankingWeights {
  readonly recency: number;
  readonly sourcePriority: number;
  readonly alignment: number;
  readonly freshness: number;
}

export interface BudgetConfig {
  readonly reservedRatio: number;
  readonly maxReservedTokens: number;
  readonly providerAllocation: 'proportional' | 'equal' | 'first-priority';
}

export interface CompressionConfig {
  readonly enabled: boolean;
  readonly maxItemTokens: number;
}

export interface ContextPolicy {
  readonly name: string;
  readonly roles: readonly AgentRole[];
  readonly providerConfig: Readonly<Record<string, ProviderPolicyConfig>>;
  readonly ranking: RankingWeights;
  readonly budget: BudgetConfig;
  readonly compression: CompressionConfig;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  recency: 0.3,
  sourcePriority: 0.3,
  alignment: 0.3,
  freshness: 0.1,
};

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  reservedRatio: 0.3,
  maxReservedTokens: 8_000,
  providerAllocation: 'proportional',
};

export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  enabled: true,
  maxItemTokens: 2_000,
};

export function createDefaultPolicy(name: string, roles: readonly AgentRole[]): ContextPolicy {
  return {
    name,
    roles,
    providerConfig: {},
    ranking: DEFAULT_RANKING_WEIGHTS,
    budget: DEFAULT_BUDGET_CONFIG,
    compression: DEFAULT_COMPRESSION_CONFIG,
  };
}

export const EXECUTOR_POLICY: ContextPolicy = {
  name: 'executor',
  roles: ['executor'],
  providerConfig: {
    ['current-context' as string]: { enabled: true, priorityOverride: 1.0 },
    ['task-graph' as string]: { enabled: true, priorityOverride: 0.9 },
    ['tool-results' as string]: { enabled: true, priorityOverride: 0.8 },
    ['file' as string]: { enabled: true, priorityOverride: 0.7 },
    ['git' as string]: { enabled: true, priorityOverride: 0.6 },
    ['memory' as string]: { enabled: true, priorityOverride: 0.3 },
    ['strategy' as string]: { enabled: false },
    ['mission' as string]: { enabled: true, priorityOverride: 0.5 },
    ['goal' as string]: { enabled: true, priorityOverride: 0.5 },
    ['documentation' as string]: { enabled: false },
    ['architecture' as string]: { enabled: false },
    ['user-preferences' as string]: { enabled: true, priorityOverride: 0.4 },
  },
  ranking: { recency: 0.4, sourcePriority: 0.3, alignment: 0.2, freshness: 0.1 },
  budget: { reservedRatio: 0.3, maxReservedTokens: 8_000, providerAllocation: 'proportional' },
  compression: { enabled: true, maxItemTokens: 2_000 },
};

export const ANALYST_POLICY: ContextPolicy = {
  name: 'analyst',
  roles: ['analyst'],
  providerConfig: {
    ['current-context' as string]: { enabled: true, priorityOverride: 0.8 },
    ['memory' as string]: { enabled: true, priorityOverride: 1.0 },
    ['documentation' as string]: { enabled: true, priorityOverride: 0.9 },
    ['architecture' as string]: { enabled: true, priorityOverride: 0.8 },
    ['user-preferences' as string]: { enabled: true, priorityOverride: 0.7 },
    ['mission' as string]: { enabled: true, priorityOverride: 0.6 },
    ['goal' as string]: { enabled: true, priorityOverride: 0.6 },
    ['strategy' as string]: { enabled: false },
    ['task-graph' as string]: { enabled: false },
    ['file' as string]: { enabled: false },
    ['git' as string]: { enabled: false },
    ['tool-results' as string]: { enabled: false },
  },
  ranking: { recency: 0.2, sourcePriority: 0.3, alignment: 0.4, freshness: 0.1 },
  budget: { reservedRatio: 0.2, maxReservedTokens: 6_000, providerAllocation: 'proportional' },
  compression: { enabled: true, maxItemTokens: 4_000 },
};

export const ARCHITECT_POLICY: ContextPolicy = {
  name: 'architect',
  roles: ['architect'],
  providerConfig: {
    ['current-context' as string]: { enabled: true, priorityOverride: 0.9 },
    ['mission' as string]: { enabled: true, priorityOverride: 1.0 },
    ['goal' as string]: { enabled: true, priorityOverride: 1.0 },
    ['strategy' as string]: { enabled: true, priorityOverride: 1.0 },
    ['architecture' as string]: { enabled: true, priorityOverride: 0.9 },
    ['documentation' as string]: { enabled: true, priorityOverride: 0.7 },
    ['memory' as string]: { enabled: true, priorityOverride: 0.5 },
    ['task-graph' as string]: { enabled: true, priorityOverride: 0.6 },
    ['user-preferences' as string]: { enabled: false },
    ['file' as string]: { enabled: false },
    ['git' as string]: { enabled: false },
    ['tool-results' as string]: { enabled: false },
  },
  ranking: { recency: 0.15, sourcePriority: 0.35, alignment: 0.4, freshness: 0.1 },
  budget: { reservedRatio: 0.4, maxReservedTokens: 12_000, providerAllocation: 'proportional' },
  compression: { enabled: true, maxItemTokens: 3_000 },
};

export const CREATIVE_DIRECTOR_POLICY: ContextPolicy = {
  name: 'creative-director',
  roles: ['creative-director'],
  providerConfig: {
    ['current-context' as string]: { enabled: true, priorityOverride: 1.0 },
    ['mission' as string]: { enabled: true, priorityOverride: 1.0 },
    ['goal' as string]: { enabled: true, priorityOverride: 1.0 },
    ['strategy' as string]: { enabled: true, priorityOverride: 1.0 },
    ['memory' as string]: { enabled: true, priorityOverride: 0.8 },
    ['task-graph' as string]: { enabled: true, priorityOverride: 0.7 },
    ['architecture' as string]: { enabled: true, priorityOverride: 0.6 },
    ['documentation' as string]: { enabled: true, priorityOverride: 0.5 },
    ['file' as string]: { enabled: true, priorityOverride: 0.4 },
    ['git' as string]: { enabled: true, priorityOverride: 0.3 },
    ['tool-results' as string]: { enabled: true, priorityOverride: 0.6 },
    ['user-preferences' as string]: { enabled: true, priorityOverride: 0.5 },
  },
  ranking: { recency: 0.2, sourcePriority: 0.4, alignment: 0.3, freshness: 0.1 },
  budget: { reservedRatio: 0.25, maxReservedTokens: 16_000, providerAllocation: 'proportional' },
  compression: { enabled: true, maxItemTokens: 4_000 },
};

export const REVIEWER_POLICY: ContextPolicy = {
  name: 'code-reviewer',
  roles: ['code-reviewer'],
  providerConfig: {
    ['current-context' as string]: { enabled: true, priorityOverride: 0.8 },
    ['file' as string]: { enabled: true, priorityOverride: 1.0 },
    ['git' as string]: { enabled: true, priorityOverride: 0.9 },
    ['task-graph' as string]: { enabled: true, priorityOverride: 0.4 },
    ['memory' as string]: { enabled: true, priorityOverride: 0.3 },
    ['documentation' as string]: { enabled: true, priorityOverride: 0.5 },
    ['architecture' as string]: { enabled: true, priorityOverride: 0.6 },
    ['mission' as string]: { enabled: true, priorityOverride: 0.3 },
    ['goal' as string]: { enabled: true, priorityOverride: 0.3 },
    ['strategy' as string]: { enabled: false },
    ['tool-results' as string]: { enabled: false },
    ['user-preferences' as string]: { enabled: true, priorityOverride: 0.4 },
  },
  ranking: { recency: 0.3, sourcePriority: 0.2, alignment: 0.4, freshness: 0.1 },
  budget: { reservedRatio: 0.3, maxReservedTokens: 8_000, providerAllocation: 'proportional' },
  compression: { enabled: true, maxItemTokens: 3_000 },
};

export const GENERAL_POLICY: ContextPolicy = {
  name: 'general',
  roles: ['*'],
  providerConfig: {
    ['current-context' as string]: { enabled: true, priorityOverride: 0.8 },
    ['task-graph' as string]: { enabled: true, priorityOverride: 0.7 },
    ['tool-results' as string]: { enabled: true, priorityOverride: 0.7 },
    ['file' as string]: { enabled: true, priorityOverride: 0.6 },
    ['git' as string]: { enabled: true, priorityOverride: 0.5 },
    ['memory' as string]: { enabled: true, priorityOverride: 0.4 },
    ['mission' as string]: { enabled: true, priorityOverride: 0.5 },
    ['goal' as string]: { enabled: true, priorityOverride: 0.5 },
    ['user-preferences' as string]: { enabled: true, priorityOverride: 0.3 },
    ['strategy' as string]: { enabled: true, priorityOverride: 0.2 },
    ['architecture' as string]: { enabled: true, priorityOverride: 0.2 },
    ['documentation' as string]: { enabled: true, priorityOverride: 0.1 },
  },
  ranking: DEFAULT_RANKING_WEIGHTS,
  budget: DEFAULT_BUDGET_CONFIG,
  compression: DEFAULT_COMPRESSION_CONFIG,
};

export const BUILT_IN_POLICIES: readonly ContextPolicy[] = [
  EXECUTOR_POLICY,
  ANALYST_POLICY,
  ARCHITECT_POLICY,
  CREATIVE_DIRECTOR_POLICY,
  REVIEWER_POLICY,
  GENERAL_POLICY,
];

export function findPolicyForRole(
  policies: readonly ContextPolicy[],
  role: AgentRole,
): ContextPolicy {
  for (const policy of policies) {
    if (policy.roles.includes(role)) {
      return policy;
    }
  }
  for (const policy of policies) {
    if (policy.roles.includes('*')) {
      return policy;
    }
  }
  return GENERAL_POLICY;
}
