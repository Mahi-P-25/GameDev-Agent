import { TaskGraphBuilder } from './builder';
import type { TaskGraph, TaskGraphConfig } from './types';

export function makeLinearGraph(n: number, config?: TaskGraphConfig): TaskGraph {
  const builder = new TaskGraphBuilder(config);
  for (let i = 0; i < n; i++) {
    builder.addNode(`n${i}`, { label: `Node ${i}` });
  }
  for (let i = 1; i < n; i++) {
    builder.addEdge(`n${i - 1}`, `n${i}`);
  }
  return builder.build();
}

export function makeDiamondGraph(width: number, config?: TaskGraphConfig): TaskGraph {
  const builder = new TaskGraphBuilder(config);
  builder.addNode('source', { label: 'Source' });
  for (let i = 0; i < width; i++) {
    builder.addNode(`p${i}`, { label: `Parallel ${i}` });
    builder.addEdge('source', `p${i}`);
  }
  builder.addNode('sink', { label: 'Sink' });
  for (let i = 0; i < width; i++) {
    builder.addEdge(`p${i}`, 'sink');
  }
  return builder.build();
}

export function makeLayeredDAG(layers: number, width: number, config?: TaskGraphConfig): TaskGraph {
  const builder = new TaskGraphBuilder(config);
  for (let l = 0; l < layers; l++) {
    for (let w = 0; w < width; w++) {
      builder.addNode(`l${l}_w${w}`, { label: `L${l}W${w}` });
    }
  }
  for (let l = 1; l < layers; l++) {
    for (let w = 0; w < width; w++) {
      for (let pw = 0; pw < width; pw++) {
        builder.addEdge(`l${l - 1}_w${pw}`, `l${l}_w${w}`);
      }
    }
  }
  return builder.build();
}

export function makeCyclicGraph(config?: TaskGraphConfig): TaskGraph {
  const builder = new TaskGraphBuilder(config);
  builder.addNode('a', { label: 'A' });
  builder.addNode('b', { label: 'B' });
  builder.addNode('c', { label: 'C' });
  builder.addEdge('a', 'b');
  builder.addEdge('b', 'c');
  builder.addEdge('c', 'a');
  return builder.build();
}

export function makeBinaryTreeGraph(depth: number, config?: TaskGraphConfig): TaskGraph {
  const builder = new TaskGraphBuilder(config);
  const totalNodes = 2 ** depth - 1;
  for (let i = 0; i < totalNodes; i++) {
    builder.addNode(`n${i}`, { label: `Node ${i}` });
  }
  for (let i = 0; i < totalNodes; i++) {
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    if (left < totalNodes) {
      builder.addEdge(`n${i}`, `n${left}`);
    }
    if (right < totalNodes) {
      builder.addEdge(`n${i}`, `n${right}`);
    }
  }
  return builder.build();
}

export function makeEmptyGraph(config?: TaskGraphConfig): TaskGraph {
  return new TaskGraphBuilder(config).build();
}

export function makeSingleNodeGraph(config?: TaskGraphConfig): TaskGraph {
  return new TaskGraphBuilder(config).addNode('single', { label: 'Single' }).build();
}

export function makeForkJoinGraph(config?: TaskGraphConfig): TaskGraph {
  const builder = new TaskGraphBuilder(config);
  builder.addNode('start', { label: 'Start' });
  builder.addNode('mid-a', { label: 'Mid A' });
  builder.addNode('mid-b', { label: 'Mid B' });
  builder.addNode('mid-c', { label: 'Mid C' });
  builder.addNode('end', { label: 'End' });
  builder.addEdge('start', 'mid-a');
  builder.addEdge('start', 'mid-b');
  builder.addEdge('start', 'mid-c');
  builder.addEdge('mid-a', 'end');
  builder.addEdge('mid-b', 'end');
  builder.addEdge('mid-c', 'end');
  return builder.build();
}
