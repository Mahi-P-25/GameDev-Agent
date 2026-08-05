import { scanAssets } from '../analyzers/assetScanner';
import { extensionOf, normalizePath } from '../shared/paths';
import type { DirectoryNode, ExtensionCount, FileIndex, FolderIndex } from '../types';

/** Directories excluded from the folder index (build output, VCS, caches). */
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.turbo',
  '.cache',
  '.vite',
  'coverage',
  '__pycache__',
]);

/**
 * Folder Indexer.
 *
 * Turns the flat {@link FileIndex} into a structured in-memory index: folders,
 * files, extension counts, an asset inventory (reusing the shared asset
 * scanner), and a recursive {@link DirectoryNode} tree.
 */
export class FolderIndexer {
  /** Index a file index into a {@link FolderIndex}. */
  index(files: FileIndex): FolderIndex {
    const allPaths = Object.keys(files).map(normalizePath).sort();
    const visiblePaths = allPaths.filter(isVisible);

    const folders = new Set<string>();
    for (const path of visiblePaths) {
      for (const folder of parentFolders(path)) {
        folders.add(folder);
      }
    }

    return {
      folders: [...folders].sort(),
      files: visiblePaths,
      extensions: countExtensions(visiblePaths),
      assets: scanAssets(files),
      tree: buildTree(visiblePaths),
    };
  }
}

/** Pure-function form of {@link FolderIndexer}. */
export function indexFolders(files: FileIndex): FolderIndex {
  return new FolderIndexer().index(files);
}

function isVisible(path: string): boolean {
  return !path.split('/').some((segment) => IGNORED_DIRS.has(segment));
}

function parentFolders(path: string): string[] {
  const parents: string[] = [];
  const parts = path.split('/');
  let current = '';
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === undefined) break;
    current = current === '' ? part : `${current}/${part}`;
    parents.push(current);
  }
  return parents;
}

function countExtensions(paths: readonly string[]): ExtensionCount[] {
  const counts = new Map<string, number>();
  for (const path of paths) {
    const extension = extensionOf(path) || '(none)';
    counts.set(extension, (counts.get(extension) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([extension, count]) => ({ extension, count }))
    .sort((a, b) => b.count - a.count || a.extension.localeCompare(b.extension));
}

interface MutableNode {
  readonly name: string;
  readonly path: string;
  readonly type: 'directory' | 'file';
  readonly children: Map<string, MutableNode>;
}

function buildTree(paths: readonly string[]): readonly DirectoryNode[] {
  const root = new Map<string, MutableNode>();

  for (const path of paths) {
    const parts = path.split('/');
    let container = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === undefined) break;
      const isLast = i === parts.length - 1;
      if (isLast) {
        if (!container.has(part)) {
          container.set(part, { name: part, path, type: 'file', children: new Map() });
        }
        break;
      }
      let dirNode = container.get(part);
      if (dirNode === undefined) {
        dirNode = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          type: 'directory',
          children: new Map(),
        };
        container.set(part, dirNode);
      }
      container = dirNode.children;
    }
  }

  return [...root.values()].sort(compareNodes).map(toDirectoryNode);
}

function toDirectoryNode(node: MutableNode): DirectoryNode {
  if (node.type === 'file') {
    return { name: node.name, path: node.path, type: 'file' };
  }
  const children = [...node.children.values()].sort(compareNodes).map(toDirectoryNode);
  const fileCount = countFiles(node);
  return {
    name: node.name,
    path: node.path,
    type: 'directory',
    ...(children.length > 0 ? { children } : {}),
    fileCount,
  };
}

function countFiles(node: MutableNode): number {
  let count = 0;
  for (const child of node.children.values()) {
    if (child.type === 'file') {
      count++;
    }
  }
  return count;
}

function compareNodes(a: MutableNode, b: MutableNode): number {
  if (a.type !== b.type) {
    return a.type === 'directory' ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}
