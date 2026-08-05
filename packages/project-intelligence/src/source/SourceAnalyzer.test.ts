import { describe, expect, it } from 'vitest';
import type { FileIndex } from '../types';
import { SourceAnalyzer, analyzeSource } from './SourceAnalyzer';

const SOURCE_PROJECT: FileIndex = {
  'src/index.ts': `
    import { Player } from './entities/player';
    import { Game } from './core/Game';
    import { logger } from './util';

    export class App {}
    export interface Config { x: number }
    export function boot(): void {}
    export const VERSION = '1';
    export { Config, boot } from './shared';
    type Internal = string;
  `,
  'src/entities/player.ts': `export class Player { name = 'x'; } export function spawn() {}`,
  'src/core/Game.ts': 'export class Game {}',
  'src/util.ts': 'export const logger = () => {};',
};

describe('SourceAnalyzer', () => {
  it('indexes classes, interfaces, functions, and types with kinds', () => {
    const index = new SourceAnalyzer().analyze(SOURCE_PROJECT);

    expect(index.classes.map((s) => s.name)).toEqual(
      expect.arrayContaining(['App', 'Player', 'Game']),
    );
    expect(index.interfaces.map((s) => s.name)).toEqual(['Config']);
    expect(index.functions.map((s) => s.name)).toEqual(expect.arrayContaining(['boot', 'spawn']));
    expect(index.types.map((s) => s.name)).toEqual(expect.arrayContaining(['Internal']));

    expect(index.symbols).toEqual(
      expect.arrayContaining([
        { name: 'App', kind: 'class', filePath: 'src/index.ts' },
        { name: 'spawn', kind: 'function', filePath: 'src/entities/player.ts' },
      ]),
    );
  });

  it('captures per-file imports and exports', () => {
    const index = analyzeSource(SOURCE_PROJECT);

    const entry = index.files.find((f) => f.path === 'src/index.ts');
    expect(entry?.imports).toEqual(
      expect.arrayContaining(['./entities/player', './core/Game', './util', './shared']),
    );
    expect(entry?.exports).toEqual(expect.arrayContaining(['App', 'Config', 'boot', 'VERSION']));
    expect(entry?.classes).toEqual(['App']);
    expect(entry?.interfaces).toEqual(['Config']);
    expect(entry?.functions).toEqual(['boot']);

    expect(index.totalImports).toBeGreaterThanOrEqual(4);
  });

  it('builds a module graph by resolving relative imports', () => {
    const index = analyzeSource(SOURCE_PROJECT);

    const edges = index.graph.edges;
    expect(edges).toEqual(
      expect.arrayContaining([
        { from: 'src/index.ts', to: 'src/entities/player.ts', symbol: 'Player' },
        { from: 'src/index.ts', to: 'src/core/Game.ts', symbol: 'Game' },
        { from: 'src/index.ts', to: 'src/util.ts', symbol: 'logger' },
      ]),
    );
    expect(index.graph.nodes).toEqual(
      expect.arrayContaining([
        'src/index.ts',
        'src/entities/player.ts',
        'src/core/Game.ts',
        'src/util.ts',
      ]),
    );
  });

  it('aggregates the public API across files', () => {
    const index = analyzeSource(SOURCE_PROJECT);

    expect(index.publicApi.names).toEqual(
      expect.arrayContaining(['App', 'Player', 'Game', 'logger', 'spawn', 'Config', 'boot']),
    );
    expect(index.publicApi.files.App).toEqual(['src/index.ts']);
    expect(index.publicApi.files.Player).toEqual(['src/entities/player.ts']);
  });

  it('does not resolve external packages into graph edges', () => {
    const index = analyzeSource({
      'src/a.ts': 'import React from "react"; export const a = 1;',
    });
    expect(index.graph.edges).toEqual([]);
    expect(index.files[0]?.imports).toEqual(['react']);
  });
});
