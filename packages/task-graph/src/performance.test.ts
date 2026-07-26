import { afterAll, describe, expect, it } from 'vitest';
import { computeLevels, criticalPath, flattenGraph, hasCycle, topologicalSort } from './algorithms';
import { TaskGraphBuilder } from './builder';
import type { TaskGraph } from './types';
import { TaskGraphValidator } from './validator';

interface BenchmarkResult {
  name: string;
  nodeCount: number;
  edgeCount: number;
  buildMs: number;
  validateMs: number;
  sortMs: number;
  criticalPathMs: number;
  levelsMs: number;
}

const results: BenchmarkResult[] = [];

function buildLinearChain(n: number): TaskGraph {
  const b = new TaskGraphBuilder({ id: `linear-${n}` });
  for (let i = 0; i < n; i++) {
    b.addNode(`n${i}`, { label: `Node ${i}` });
  }
  for (let i = 1; i < n; i++) {
    b.addEdge(`n${i - 1}`, `n${i}`);
  }
  return b.build();
}

function buildDiamond(width: number): TaskGraph {
  const b = new TaskGraphBuilder({ id: `diamond-${width}` });
  b.addNode('source', { label: 'Source' });
  for (let i = 0; i < width; i++) {
    b.addNode(`p${i}`, { label: `P${i}` });
    b.addEdge('source', `p${i}`);
  }
  b.addNode('sink', { label: 'Sink' });
  for (let i = 0; i < width; i++) {
    b.addEdge(`p${i}`, 'sink');
  }
  return b.build();
}

function buildLayeredDAG(layers: number, width: number): TaskGraph {
  const b = new TaskGraphBuilder({ id: `layered-${layers}x${width}` });
  for (let l = 0; l < layers; l++) {
    for (let w = 0; w < width; w++) {
      b.addNode(`l${l}_w${w}`, { label: `L${l}W${w}` });
    }
  }
  for (let l = 1; l < layers; l++) {
    for (let w = 0; w < width; w++) {
      for (let pw = 0; pw < width; pw++) {
        b.addEdge(`l${l - 1}_w${pw}`, `l${l}_w${w}`);
      }
    }
  }
  return b.build();
}

function elapsedMs(start: [number, number]): number {
  const diff = process.hrtime(start);
  return diff[0] * 1000 + diff[1] / 1_000_000;
}

async function benchmark(
  name: string,
  graph: TaskGraph,
  validator: TaskGraphValidator,
): Promise<BenchmarkResult> {
  const flat = flattenGraph(graph);

  const t0 = process.hrtime();
  const buildMs = elapsedMs(t0);

  const t1 = process.hrtime();
  validator.validate(graph);
  const validateMs = elapsedMs(t1);

  const t2 = process.hrtime();
  topologicalSort(flat);
  const sortMs = elapsedMs(t2);

  const t3 = process.hrtime();
  criticalPath(flat);
  const criticalPathMs = elapsedMs(t3);

  const t4 = process.hrtime();
  computeLevels(flat);
  const levelsMs = elapsedMs(t4);

  const result: BenchmarkResult = {
    name,
    nodeCount: flat.nodes.size,
    edgeCount: flat.edges.length,
    buildMs,
    validateMs,
    sortMs,
    criticalPathMs,
    levelsMs,
  };

  return result;
}

describe('Task Graph Performance Benchmarks', () => {
  const validator = new TaskGraphValidator();

  describe('small graphs (100 nodes)', () => {
    it('linear chain 100', async () => {
      const graph = buildLinearChain(100);
      const r = await benchmark('linear-100', graph, validator);
      results.push(r);
      expect(r.buildMs).toBeLessThan(100);
      expect(r.sortMs).toBeLessThan(50);
      expect(r.criticalPathMs).toBeLessThan(50);
    });

    it('diamond 100', async () => {
      const graph = buildDiamond(100);
      const r = await benchmark('diamond-100', graph, validator);
      results.push(r);
      expect(r.validateMs).toBeLessThan(100);
      expect(r.sortMs).toBeLessThan(50);
    });

    it('layered 10x10', async () => {
      const graph = buildLayeredDAG(10, 10);
      const r = await benchmark('layered-10x10', graph, validator);
      results.push(r);
      expect(r.validateMs).toBeLessThan(200);
      expect(r.sortMs).toBeLessThan(100);
    });
  });

  describe('medium graphs (500 nodes)', () => {
    it('linear chain 500', async () => {
      const graph = buildLinearChain(500);
      const r = await benchmark('linear-500', graph, validator);
      results.push(r);
      expect(r.buildMs).toBeLessThan(200);
      expect(r.sortMs).toBeLessThan(100);
    });

    it('diamond 500', async () => {
      const graph = buildDiamond(500);
      const r = await benchmark('diamond-500', graph, validator);
      results.push(r);
      expect(r.validateMs).toBeLessThan(200);
    });
  });

  describe('large graphs (1000+ nodes)', () => {
    it('linear chain 1000', async () => {
      const graph = buildLinearChain(1000);
      const r = await benchmark('linear-1000', graph, validator);
      results.push(r);
      expect(r.buildMs).toBeLessThan(500);
      expect(r.sortMs).toBeLessThan(200);
    });

    it('layered 20x50', async () => {
      const graph = buildLayeredDAG(20, 50);
      const r = await benchmark('layered-20x50', graph, validator);
      results.push(r);
      expect(r.validateMs).toBeLessThan(500);
    });
  });

  describe('edge cases', () => {
    it('very wide diamond 2000', async () => {
      const graph = buildDiamond(2000);
      const r = await benchmark('diamond-2000', graph, validator);
      results.push(r);
      expect(r.sortMs).toBeLessThan(200);
    });
  });

  describe('hasCycle performance', () => {
    it('detects no cycle in 1000-node DAG quickly', () => {
      const graph = buildLayeredDAG(20, 50);
      const flat = flattenGraph(graph);
      const t0 = process.hrtime();
      const result = hasCycle(flat);
      const ms = elapsedMs(t0);
      expect(result).toBe(false);
      expect(ms).toBeLessThan(500);
    });
  });

  afterAll(() => {
    console.log('\n=== Task Graph Benchmark Results ===');
    console.log(
      `${'Name'.padEnd(25)} ${'Nodes'.padEnd(8)} ${'Edges'.padEnd(8)} ${'Build'.padEnd(10)} ${'Validate'.padEnd(10)} ${'Sort'.padEnd(10)} ${'CPath'.padEnd(10)} ${'Levels'.padEnd(10)}`,
    );
    console.log('\u2500'.repeat(91));
    for (const r of results) {
      console.log(
        `${r.name.padEnd(25)} ${String(r.nodeCount).padEnd(8)} ${String(r.edgeCount).padEnd(8)} ${r.buildMs.toFixed(2).padEnd(10)} ${r.validateMs.toFixed(2).padEnd(10)} ${r.sortMs.toFixed(2).padEnd(10)} ${r.criticalPathMs.toFixed(2).padEnd(10)} ${r.levelsMs.toFixed(2).padEnd(10)}`,
      );
    }
    console.log('\u2500'.repeat(91));
  });
});
