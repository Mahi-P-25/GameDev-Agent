import { describe, expect, it } from 'vitest';
import { TaskGraphBuilder } from './builder';
import {
  makeDiamondGraph,
  makeEmptyGraph,
  makeForkJoinGraph,
  makeLinearGraph,
  makeSingleNodeGraph,
} from './test_helpers';
import { TaskGraphValidator, VALIDATION_ERROR_CODES, VALIDATION_WARNING_CODES } from './validator';

const validator = new TaskGraphValidator();

describe('TaskGraphValidator', () => {
  describe('valid graphs', () => {
    it('accepts a linear graph', () => {
      const result = validator.validate(makeLinearGraph(5));
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts a diamond graph', () => {
      const result = validator.validate(makeDiamondGraph(4));
      expect(result.valid).toBe(true);
    });

    it('accepts a fork-join graph', () => {
      const result = validator.validate(makeForkJoinGraph());
      expect(result.valid).toBe(true);
    });

    it('accepts a single node', () => {
      const result = validator.validate(makeSingleNodeGraph());
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid graphs', () => {
    it('rejects an empty graph', () => {
      const result = validator.validate(makeEmptyGraph());
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === VALIDATION_ERROR_CODES.EMPTY_GRAPH)).toBe(true);
    });

    it('rejects a cyclic graph', () => {
      const graph = new TaskGraphBuilder()
        .addNode('a', { label: 'A' })
        .addNode('b', { label: 'B' })
        .addNode('c', { label: 'C' })
        .addEdge('a', 'b')
        .addEdge('b', 'c')
        .addEdge('c', 'a')
        .build();
      const result = validator.validate(graph);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === VALIDATION_ERROR_CODES.CYCLE_DETECTED)).toBe(
        true,
      );
    });

    it('rejects self-loops', () => {
      const graph = new TaskGraphBuilder().addNode('a', { label: 'A' }).addEdge('a', 'a').build();
      const result = validator.validate(graph);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === VALIDATION_ERROR_CODES.SELF_LOOP)).toBe(true);
    });

    it('rejects duplicate edges', () => {
      const graph = new TaskGraphBuilder()
        .addNode('a', { label: 'A' })
        .addNode('b', { label: 'B' })
        .addEdge('a', 'b')
        .addEdge('a', 'b')
        .build();
      const result = validator.validate(graph);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === VALIDATION_ERROR_CODES.DUPLICATE_EDGE)).toBe(
        true,
      );
    });

    it('rejects edges to missing targets', () => {
      const graph = new TaskGraphBuilder()
        .addNode('a', { label: 'A' })
        .addNode('b', { label: 'B' })
        .build();
      const result = validator.validate(graph);
      expect(result.valid).toBe(true);
    });

    it('rejects subgraph with cycles', () => {
      const subBuilder = new TaskGraphBuilder({ id: 'sub' })
        .addNode('s1', { label: 'S1' })
        .addNode('s2', { label: 'S2' })
        .addEdge('s1', 's2')
        .addEdge('s2', 's1');
      const graph = new TaskGraphBuilder({ id: 'parent' })
        .addNode('main', { label: 'Main' })
        .addSubgraph(subBuilder)
        .build();
      const result = validator.validate(graph);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === VALIDATION_ERROR_CODES.CYCLE_DETECTED)).toBe(
        true,
      );
    });
  });

  describe('warnings', () => {
    it('warns about disconnected nodes', () => {
      const graph = new TaskGraphBuilder()
        .addNode('a', { label: 'A' })
        .addNode('b', { label: 'B' })
        .addNode('c', { label: 'C' })
        .addEdge('a', 'b')
        .build();
      const result = validator.validate(graph);
      expect(
        result.warnings.some((w) => w.code === VALIDATION_WARNING_CODES.DISCONNECTED_NODE),
      ).toBe(true);
    });

    it('does not warn for a fully connected graph', () => {
      const result = validator.validate(makeLinearGraph(3));
      expect(
        result.warnings.filter((w) => w.code === VALIDATION_WARNING_CODES.DISCONNECTED_NODE),
      ).toHaveLength(0);
    });
  });
});
