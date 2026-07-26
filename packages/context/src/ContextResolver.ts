import type { ContextSourceName } from './ContextPackage';
import { ContextPolicyError } from './ContextPipelineErrors';
import type { ContextPolicy, ProviderPolicyConfig } from './ContextPolicy';
import { findPolicyForRole } from './ContextPolicy';
import type { ContextProvider } from './ContextProvider';
import type { ContextRequest } from './ContextRequest';
import type { ProviderRegistry } from './ProviderRegistry';

export interface ResolvedProviders {
  readonly providers: readonly ContextProvider[];
  readonly policy: ContextPolicy;
}

function providerEnabled(
  policyConfig: Readonly<Record<string, ProviderPolicyConfig>>,
  sourceName: ContextSourceName,
): boolean {
  const config = policyConfig[sourceName];
  if (config === undefined) {
    return true;
  }
  return config.enabled;
}

export class ContextResolver {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly policies: readonly ContextPolicy[],
  ) {}

  resolve(request: ContextRequest): ResolvedProviders {
    const policy = findPolicyForRole(this.policies, request.role);
    if (policy === undefined) {
      throw new ContextPolicyError(request.role, `No policy registered for role "${request.role}"`);
    }

    const requiredOverride = request.requiredSources;
    const excludedOverride = request.excludeSources;

    const excludedSet = new Set<string>(excludedOverride?.map((s) => String(s)) ?? []);

    const candidates = this.registry.all();
    const matched: ContextProvider[] = [];

    for (const provider of candidates) {
      const name = String(provider.metadata.sourceName);

      if (excludedSet.has(name)) {
        continue;
      }

      if (requiredOverride !== undefined && requiredOverride.length > 0) {
        if (requiredOverride.includes(provider.metadata.sourceName)) {
          matched.push(provider);
        }
        continue;
      }

      if (!providerEnabled(policy.providerConfig, provider.metadata.sourceName)) {
        continue;
      }

      matched.push(provider);
    }

    matched.sort((a, b) => {
      const aOverride = policy.providerConfig[String(a.metadata.sourceName)]?.priorityOverride;
      const bOverride = policy.providerConfig[String(b.metadata.sourceName)]?.priorityOverride;
      const aPriority = aOverride ?? a.metadata.priority;
      const bPriority = bOverride ?? b.metadata.priority;
      return bPriority - aPriority;
    });

    return { providers: matched, policy };
  }
}
