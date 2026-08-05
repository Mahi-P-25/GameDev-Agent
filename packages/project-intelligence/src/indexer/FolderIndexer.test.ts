import { describe, expect, it } from 'vitest';
import type { FileIndex } from '../types';
import { FolderIndexer, indexFolders } from './FolderIndexer';

const TREE_PROJECT: FileIndex = {
  'package.json': '{}',
  'src/index.ts': 'export const a = 1;',
  'src/components/Button.tsx': 'export const Button = () => null;',
  'src/styles/app.css': 'body {}',
  'assets/models/car.glb': '\u0000',
  'assets/textures/tile.png': '\u0000',
  'node_modules/x/index.js': '// ignored',
  'dist/bundle.js': '// ignored',
};

describe('FolderIndexer', () => {
  it('indexes folders and files, excluding ignored build/VCS directories', () => {
    const index = new FolderIndexer().index(TREE_PROJECT);

    expect(index.folders).toContain('src');
    expect(index.folders).toContain('src/components');
    expect(index.folders).toContain('assets/models');
    expect(index.folders).not.toContain('node_modules');
    expect(index.folders).not.toContain('dist');

    expect(index.files).toContain('src/index.ts');
    expect(index.files).not.toContain('node_modules/x/index.js');
  });

  it('counts extensions across the visible tree', () => {
    const index = indexFolders(TREE_PROJECT);
    const extensions = new Map(index.extensions.map((e) => [e.extension, e.count]));

    expect(extensions.get('.ts')).toBe(1);
    expect(extensions.get('.tsx')).toBe(1);
    expect(extensions.get('.png')).toBe(1);
    expect(extensions.get('.glb')).toBe(1);
  });

  it('reuses the shared asset scanner for the asset inventory', () => {
    const index = indexFolders(TREE_PROJECT);
    expect(index.assets.models).toBe(1);
    expect(index.assets.textures).toBe(1);
  });

  it('builds a recursive in-memory tree with directories before files', () => {
    const index = indexFolders(TREE_PROJECT);

    const topLevel = index.tree.map((node) => node.path);
    expect(topLevel).toEqual(['assets', 'src', 'package.json']);

    const src = index.tree.find((node) => node.path === 'src');
    expect(src?.type).toBe('directory');
    const srcChildren = src?.children?.map((node) => node.path);
    expect(srcChildren).toContain('src/components');
    expect(srcChildren).toContain('src/styles');
    expect(srcChildren).toContain('src/index.ts');
    expect(src?.fileCount).toBe(1);

    const components = src?.children?.find((node) => node.path === 'src/components');
    expect(components?.children?.map((node) => node.path)).toEqual(['src/components/Button.tsx']);
  });

  it('returns an empty index for an empty project', () => {
    const index = indexFolders({});
    expect(index.folders).toEqual([]);
    expect(index.files).toEqual([]);
    expect(index.extensions).toEqual([]);
    expect(index.tree).toEqual([]);
  });
});
