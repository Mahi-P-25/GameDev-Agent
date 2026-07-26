import { describe, expect, it } from 'vitest';
import { TaskScheduler } from './scheduler';
import {
  makeDiamondGraph,
  makeForkJoinGraph,
  makeLayeredDAG,
  makeLinearGraph,
  makeSingleNodeGraph,
} from './test_helpers';

const scheduler = new TaskScheduler();

describe('TaskScheduler', () => {
  describe('linear graph', () => {
    it('produces N stages for N nodes in sequence', () => {
      const plan = scheduler.schedule(makeLinearGraph(4));
      expect(plan.stages).toHaveLength(4);
      expect(plan.stages[0]?.nodeIds).toEqual(['n0']);
      expect(plan.stages[1]?.nodeIds).toEqual(['n1']);
      expect(plan.stages[2]?.nodeIds).toEqual(['n2']);
      expect(plan.stages[3]?.nodeIds).toEqual(['n3']);
    });

    it('critical path is the entire graph', () => {
      const plan = scheduler.schedule(makeLinearGraph(5));
      expect(plan.criticalPath).toHaveLength(5);
      expect(plan.criticalPath).toEqual(['n0', 'n1', 'n2', 'n3', 'n4']);
    });

    it('topological order matches input order', () => {
      const plan = scheduler.schedule(makeLinearGraph(3));
      expect(plan.topologicalOrder).toEqual(['n0', 'n1', 'n2']);
    });
  });

  describe('diamond graph', () => {
    it('parallel nodes share the same stage', () => {
      const plan = scheduler.schedule(makeDiamondGraph(3));
      const stage1 = plan.stages[0];
      const stage2 = plan.stages[1];
      const stage3 = plan.stages[2];
      expect(stage1?.nodeIds).toEqual(['source']);
      expect(stage2?.nodeIds).toHaveLength(3);
      expect(stage3?.nodeIds).toEqual(['sink']);
    });

    it('stages have correct dependencies', () => {
      const plan = scheduler.schedule(makeDiamondGraph(3));
      expect(plan.stages[0]?.dependsOn).toEqual([]);
      expect(plan.stages[1]?.dependsOn).toEqual([0]);
      expect(plan.stages[2]?.dependsOn).toEqual([1]);
    });

    it('critical path includes source, one parallel, sink', () => {
      const plan = scheduler.schedule(makeDiamondGraph(3));
      expect(plan.criticalPath).toHaveLength(3);
      expect(plan.criticalPath[0]).toBe('source');
      expect(plan.criticalPath[plan.criticalPath.length - 1]).toBe('sink');
    });
  });

  describe('layered DAG', () => {
    it('creates one stage per layer', () => {
      const plan = scheduler.schedule(makeLayeredDAG(3, 2));
      expect(plan.stages).toHaveLength(3);
      expect(plan.stages[0]?.nodeIds).toHaveLength(2);
      expect(plan.stages[1]?.nodeIds).toHaveLength(2);
      expect(plan.stages[2]?.nodeIds).toHaveLength(2);
    });
  });

  describe('fork-join graph', () => {
    it('detects parallel mid nodes', () => {
      const plan = scheduler.schedule(makeForkJoinGraph());
      expect(plan.stages).toHaveLength(3);
      expect(plan.stages[0]?.nodeIds).toEqual(['start']);
      expect(plan.stages[1]?.nodeIds).toHaveLength(3);
      expect(plan.stages[2]?.nodeIds).toEqual(['end']);
    });
  });

  describe('single node', () => {
    it('creates a single stage', () => {
      const plan = scheduler.schedule(makeSingleNodeGraph());
      expect(plan.stages).toHaveLength(1);
      expect(plan.stages[0]?.nodeIds).toEqual(['single']);
      expect(plan.criticalPath).toEqual(['single']);
    });
  });

  describe('graph id propagation', () => {
    it('plan carries the graph id', () => {
      const plan = scheduler.schedule(makeLinearGraph(3, { id: 'my-graph' }));
      expect(plan.graphId).toBe('my-graph');
    });
  });
});
