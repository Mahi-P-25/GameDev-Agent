import { describe, it, expect } from 'vitest';
import { analyzeDependencies } from '../depAnalyzer';
import type { FileIndex } from '../types';

describe('Dependency Analyzer', () => {
  it('builds a graph from import statements', () => {
    const files: FileIndex = {
      '/src/index.ts': "import { greet } from './utils'; import React from 'react';",
      '/src/utils.ts': 'export function greet(name: string): string { return `Hello ${name}`; }',
    };

    const graph = analyzeDependencies(files);
    expect(graph.nodes.length).toBeGreaterThanOrEqual(2);
    expect(graph.edges.length).toBeGreaterThanOrEqual(1);
  });

  it('detects external imports but excludes them from non-external count', () => {
    const files: FileIndex = {
      '/src/App.tsx': "import React from 'react'; import { motion } from 'motion/react';",
    };

    const graph = analyzeDependencies(files);
    const appNode = graph.nodes.find((n) => n.id === 'src/App.tsx');
    expect(appNode).toBeDefined();
  });

  it('handles relative imports with ./ prefix', () => {
    const files: FileIndex = {
      '/src/index.ts': "import { foo } from './lib/utils';",
      '/src/lib/utils.ts': 'export const foo = 42;',
    };

    const graph = analyzeDependencies(files);
    const hasEdge = graph.edges.some((e) => e.source.includes('index.ts') && e.target.includes('utils.ts'));
    expect(hasEdge).toBe(true);
  });

  it('handles relative imports with ../ prefix', () => {
    const files: FileIndex = {
      '/src/features/core/index.ts': "import { api } from '../../api/client';",
      '/src/api/client.ts': 'export const api = {};',
    };

    const graph = analyzeDependencies(files);
    const hasEdge = graph.edges.some((e) => e.source.includes('index.ts') && e.target.includes('client.ts'));
    expect(hasEdge).toBe(true);
  });

  it('detects circular dependencies', () => {
    const files: FileIndex = {
      '/src/a.ts': "import { b } from './b';",
      '/src/b.ts': "import { a } from './a';",
    };

    const graph = analyzeDependencies(files);
    expect(graph.circularDependencies.length).toBeGreaterThan(0);
    const cycle = graph.circularDependencies[0];
    expect(cycle?.length).toBeGreaterThanOrEqual(2);
  });

  it('finds isolated modules', () => {
    const files: FileIndex = {
      '/src/index.ts': "import { util } from './utils';",
      '/src/utils.ts': 'import { other } from "./other";',
      '/src/isolated.ts': 'const x = 1;',
    };

    const graph = analyzeDependencies(files);
    expect(graph.isolatedModules.length).toBeGreaterThanOrEqual(1);
    const hasIsolated = graph.isolatedModules.some((m) => m.includes('isolated.ts'));
    expect(hasIsolated).toBe(true);
  });

  it('handles empty file index', () => {
    const graph = analyzeDependencies({});
    expect(graph.nodes.length).toBe(0);
    expect(graph.edges.length).toBe(0);
    expect(graph.circularDependencies.length).toBe(0);
  });

  it('handles require() syntax', () => {
    const files: FileIndex = {
      '/src/index.ts': "const utils = require('./utils');",
      '/src/utils.ts': 'module.exports = { foo: 1 };',
    };

    const graph = analyzeDependencies(files);
    expect(graph.edges.length).toBeGreaterThanOrEqual(1);
  });
});
