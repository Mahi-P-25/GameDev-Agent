import { describe, expect, it, vi } from 'vitest';
import { NoCapabilityFoundError, ToolSelector } from '@gamedev-agent/ami';
import type { CapabilityPlanner, MissionAbility, ResolvedCapability } from '@gamedev-agent/tool-runtime';
import type { StepPlan } from '@gamedev-agent/ami';

function plan(overrides?: Partial<StepPlan>): StepPlan {
  return {
    id: 'plan-1',
    goalNodeId: 'g1',
    description: 'do the thing',
    requiredCapabilityKind: 'write-files',
    params: { path: 'src/main.ts' },
    highImpact: false,
    ...overrides,
  };
}

function capability(
  overrides?: Partial<ResolvedCapability>,
): ResolvedCapability {
  return {
    ability: 'write-files' as MissionAbility,
    toolId: 'nova.tool.filesystem' as unknown as ResolvedCapability['toolId'],
    capabilityId: 'files.write',
    capabilityName: 'Write',
    confidence: 'exact',
    requiresSession: false,
    inputSchema: {},
    ...overrides,
  };
}

function planner(results: readonly ResolvedCapability[]): CapabilityPlanner {
  return {
    resolveAbilities: vi.fn().mockReturnValue(results),
    getAvailableAbilities: vi.fn().mockReturnValue([]),
  } as unknown as CapabilityPlanner;
}

describe('ToolSelector', () => {
  it('delegates matching to the CapabilityPlanner and returns a selection', async () => {
    const p = planner([capability()]);
    const selector = new ToolSelector(p);
    const selection = await selector.select(plan());
    expect(p.resolveAbilities).toHaveBeenCalledWith(['write-files']);
    expect(selection).toMatchObject({
      stepPlanId: 'plan-1',
      capabilityId: 'files.write',
      toolName: 'nova.tool.filesystem',
      params: { path: 'src/main.ts' },
    });
  });

  it('carries params unchanged from the plan', async () => {
    const selector = new ToolSelector(planner([capability()]));
    const selection = await selector.select(plan({ params: { path: 'a.ts', force: true } }));
    expect(selection.params).toEqual({ path: 'a.ts', force: true });
  });

  it('throws NoCapabilityFoundError when the planner only returns fallback', async () => {
    const selector = new ToolSelector(planner([capability({ confidence: 'fallback' })]));
    await expect(selector.select(plan())).rejects.toThrow(NoCapabilityFoundError);
  });

  it('throws NoCapabilityFoundError when the planner returns no results', async () => {
    const selector = new ToolSelector(planner([]));
    await expect(selector.select(plan())).rejects.toThrow(
      'No capability found for "write-files"',
    );
  });

  it('honors excluded capability ids (retry_alternate_tool path)', async () => {
    const selector = new ToolSelector(planner([capability()]));
    await expect(selector.select(plan(), ['files.write'])).rejects.toThrow(NoCapabilityFoundError);
  });

  it('records the exclusion list on the selection for observability', async () => {
    const selector = new ToolSelector(planner([capability({ capabilityId: 'files.write' }), capability({ capabilityId: 'files.append' })]));
    const selection = await selector.select(plan(), ['files.write']);
    expect(selection.excludedCapabilityIds).toEqual(['files.write']);
    expect(selection.capabilityId).toBe('files.append');
  });

  it('prefers an exact match over a fallback sibling', async () => {
    const selector = new ToolSelector(
      planner([capability({ capabilityId: 'files.write', confidence: 'exact' }), capability({ capabilityId: 'files.fallback', confidence: 'fallback' })]),
    );
    const selection = await selector.select(plan());
    expect(selection.capabilityId).toBe('files.write');
  });

  it('throws NoCapabilityFoundError when all exact matches are excluded', async () => {
    const selector = new ToolSelector(
      planner([capability({ capabilityId: 'files.write', confidence: 'exact' })]),
    );
    await expect(selector.select(plan(), ['files.write'])).rejects.toThrow(NoCapabilityFoundError);
  });
});
