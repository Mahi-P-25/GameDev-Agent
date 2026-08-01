import type { CapabilityPlanner, MissionAbility } from '@gamedev-agent/tool-runtime';
import type { IToolSelector } from './interfaces';
import type { StepPlan, ToolSelection } from './types';

/** Thrown when no capability can satisfy a step plan's capability kind. */
export class NoCapabilityFoundError extends Error {
  constructor(readonly capabilityKind: string) {
    super(`No capability found for "${capabilityKind}"`);
    this.name = 'NoCapabilityFoundError';
  }
}

/**
 * Thin ranking/filtering layer on top of the EXISTING Capability Planner.
 * All matching is delegated to `planner.resolveAbilities` — this class never
 * reimplements matching. It drops `fallback` (unresolved) results and honors
 * excluded capability ids (used by `retry_alternate_tool`).
 *
 * DEVIATION: the real CapabilityPlanner resolves ONE capability per requested
 * ability (its `resolveAbilities` returns a single `ResolvedCapability` per
 * ability, not a candidate list), so there is no candidate ranking to perform
 * and no memory-signal re-ordering is possible. When the resolved capability is
 * excluded there is no alternate tool to offer, so the caller receives
 * {@link NoCapabilityFoundError} and the retry/escalation path degrades
 * deterministically instead of guessing.
 */
export class ToolSelector implements IToolSelector {
  constructor(private readonly planner: CapabilityPlanner) {}

  async select(
    stepPlan: StepPlan,
    excludedCapabilityIds: readonly string[] = [],
  ): Promise<ToolSelection> {
    const resolved = this.planner.resolveAbilities([
      stepPlan.requiredCapabilityKind as MissionAbility,
    ]);

    const chosen = resolved.find(
      (c) => c.confidence !== 'fallback' && !excludedCapabilityIds.includes(c.capabilityId),
    );

    if (chosen === undefined) {
      throw new NoCapabilityFoundError(stepPlan.requiredCapabilityKind);
    }

    return {
      stepPlanId: stepPlan.id,
      capabilityId: chosen.capabilityId,
      toolName: chosen.toolId,
      params: stepPlan.params,
      excludedCapabilityIds,
    };
  }
}
