import type { FileIndex, DependencyGraph, DependencyNode, DependencyEdge } from './types';

const IMPORT_RE = /(?:import\s+(?:[\w*{},]\s+from\s+)?['"]([^'"]+)['"]|from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;

const EXTERNAL_PREFIXES = [
  '@gamedev-agent/', '@radix-ui/', '@tanstack/', '@hookform/', '@fontsource/', '@tailwindcss/', '@vitejs/', '@biomejs/',
  'react', 'react-dom', 'react-router', 'motion', 'lucide-react', 'clsx', 'class-variance-authority', 'tailwind-merge',
  'zustand', 'zod', 'cmdk', 'geist', 'hls.js', 'lenis',
];

function isExternal(importPath: string): boolean {
  if (importPath.startsWith('.')) return false;
  if (importPath.startsWith('/')) return false;
  return EXTERNAL_PREFIXES.some((p) => importPath === p || importPath.startsWith(p + '/'));
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\//, '');
}

export function analyzeDependencies(files: FileIndex): DependencyGraph {
  const moduleImports = new Map<string, Set<string>>();
  const allFiles = Object.keys(files).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx'));

  for (const filePath of allFiles) {
    const content = files[filePath];
    if (!content) continue;

    const imported = new Set<string>();
    let match: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;

    while ((match = IMPORT_RE.exec(content)) !== null) {
      const importPath = match[1] || match[2] || match[3];
      if (importPath && !isExternal(importPath)) {
        imported.add(importPath);
      }
    }

    moduleImports.set(normalizePath(filePath), imported);
  }

  const nodeMap = new Map<string, DependencyNode>();
  const edges: DependencyEdge[] = [];

  for (const [filePath, imports] of moduleImports) {
    if (!nodeMap.has(filePath)) {
      nodeMap.set(filePath, { id: filePath, path: filePath });
    }

    for (const imp of imports) {
      let resolvedPath = imp;
      if (imp.startsWith('./') || imp.startsWith('../')) {
        const baseDir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
        resolvedPath = resolveRelativePath(baseDir, imp);
        const foundModule = findBestMatch(resolvedPath, allFiles);
        if (foundModule) {
          resolvedPath = normalizePath(foundModule);
        }
      }

      if (!nodeMap.has(resolvedPath)) {
        nodeMap.set(resolvedPath, { id: resolvedPath, path: resolvedPath });
      }

      edges.push({ source: filePath, target: resolvedPath });
    }
  }

  const edgeList = edges;
  const adjList = new Map<string, string[]>();
  for (const edge of edgeList) {
    if (!adjList.has(edge.source)) adjList.set(edge.source, []);
    adjList.get(edge.source)!.push(edge.target);
  }

  const circularDeps = detectCircular(adjList);
  const nodes = [...nodeMap.values()];
  const isolatedModules = nodes
    .filter((n) => {
      const hasIncoming = edges.some((e) => e.target === n.id);
      const hasOutgoing = edges.some((e) => e.source === n.id);
      return !hasIncoming && !hasOutgoing;
    })
    .map((n) => n.path);

  return {
    nodes,
    edges,
    circularDependencies: circularDeps,
    isolatedModules,
  };
}

function resolveRelativePath(baseDir: string, relativePath: string): string {
  const parts = baseDir.split('/').filter(Boolean);
  const relative = relativePath.split('/');

  for (const part of relative) {
    if (part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }

  return parts.join('/');
}

function findBestMatch(resolvedPath: string, allFiles: string[]): string | null {
  const candidates = allFiles.filter((f) => {
    const normalized = normalizePath(f);
    return (
      normalized === resolvedPath ||
      normalized === resolvedPath + '.ts' ||
      normalized === resolvedPath + '.tsx' ||
      normalized === resolvedPath + '.js' ||
      normalized === resolvedPath + '.jsx' ||
      normalized === resolvedPath + '/index.ts' ||
      normalized === resolvedPath + '/index.tsx' ||
      normalized === resolvedPath + '/index.js'
    );
  });

  return candidates.length > 0 ? (candidates[0] ?? null) : null;
}

function detectCircular(adjList: Map<string, string[]>): string[][] {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    visited.add(node);
    inStack.add(node);
    path.push(node);

    const neighbors = adjList.get(node) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, path);
      } else if (inStack.has(neighbor)) {
        const idx = path.indexOf(neighbor);
        if (idx >= 0) {
          cycles.push([...path.slice(idx), neighbor]);
        }
      }
    }

    path.pop();
    inStack.delete(node);
  }

  for (const node of adjList.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}
