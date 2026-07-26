import { describe, expect, it } from 'vitest';
import { Workflow } from './Workflow';
import type { WorkflowStepId } from './WorkflowDefinition';
import { WorkflowValidationError } from './WorkflowErrors';
import {
  FixedClock,
  cyclicDefinition,
  diamondDefinition,
  linearDefinition,
  step,
} from './test_helpers';

function planner(): Workflow {
  return new Workflow({ clock: new FixedClock(1000) });
}

describe('Workflow planner', () => {
  it('orders a linear workflow a → b → c', () => {
    const plan = planner().plan(linearDefinition());
    expect(plan.order).toEqual(['a', 'b', 'c']);
  });

  it('orders a diamond so a precedes b/c and both precede d', () => {
    const plan = planner().plan(diamondDefinition());
    const pos = (id: string): number => plan.order.indexOf(id as WorkflowStepId);
    expect(pos('a')).toBeLessThan(pos('b'));
    expect(pos('a')).toBeLessThan(pos('c'));
    expect(pos('b')).toBeLessThan(pos('d'));
    expect(pos('c')).toBeLessThan(pos('d'));
  });

  it('produces one-step-per-wave concurrency groups in sequential mode', () => {
    const plan = planner().plan(diamondDefinition());
    expect(plan.concurrencyGroups).toEqual([['a'], ['b'], ['c'], ['d']]);
  });

  it('groups independent steps into a single wave in parallel mode', () => {
    const plan = planner().plan(diamondDefinition(), 'parallel');
    const groups = plan.concurrencyGroups.map((g) => g.slice().sort());
    expect(groups).toEqual([['a'], ['b', 'c'], ['d']]);
  });

  it('rejects an empty workflow', () => {
    const empty = { ...linearDefinition(), steps: [] };
    expect(() => planner().plan(empty)).toThrow(WorkflowValidationError);
  });

  it('rejects a duplicate step id', () => {
    const dup = {
      ...linearDefinition(),
      steps: [step('a'), step('a')],
    };
    expect(() => planner().plan(dup)).toThrow(/duplicate step id/);
  });

  it('rejects a dangling dependency reference', () => {
    const dangling = {
      ...linearDefinition(),
      steps: [step('a', ['missing'])],
    };
    expect(() => planner().plan(dangling)).toThrow(/unknown step/);
  });

  it('rejects a cyclic dependency graph', () => {
    expect(() => planner().plan(cyclicDefinition())).toThrow(/cycle/);
  });
});
