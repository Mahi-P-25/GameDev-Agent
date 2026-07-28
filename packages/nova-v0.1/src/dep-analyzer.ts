import type { LocatedFile, DependencyMap, ImpactEstimate } from './change-types';
import type { ProjectContext } from './types';

export function analyzeDependencies(
  locatedFiles: ReadonlyArray<LocatedFile>,
  context: ProjectContext,
): DependencyMap {
  const targetPaths = new Set(locatedFiles.map((f) => f.path));
  const targetFiles = Array.from(targetPaths);
  const importedBy: Record<string, string[]> = {};
  const exportsTo: Record<string, string[]> = {};
  const externalDeps = new Set<string>();

  for (const file of context.source.files) {
    if (targetPaths.has(file.path)) {
      for (const imp of file.imports) {
        if (!imp.startsWith('.')) {
          externalDeps.add(imp);
        }
      }
    }
  }

  for (const [from, to] of context.source.importGraph.edges) {
    if (targetPaths.has(to)) {
      if (!importedBy[from]) importedBy[from] = [];
      importedBy[from].push(to);
    }
  }

  for (const file of context.source.files) {
    if (targetPaths.has(file.path)) {
      const edges = context.source.importGraph.edges.filter(([from]) => from === file.path);
      const fp = file.path;
      if (!exportsTo[fp]) exportsTo[fp] = [];
      for (const edge of edges) {
        const to = edge[1];
        exportsTo[fp].push(to);
      }
    }
  }

  return {
    targetFiles,
    importedBy,
    exportsTo,
    externalDependencies: Array.from(externalDeps).sort(),
  };
}

export function estimateImpact(depMap: DependencyMap, _context: ProjectContext): ImpactEstimate {
  const transitives = new Set<string>();
  for (const importers of Object.values(depMap.importedBy)) {
    for (const imp of importers) {
      transitives.add(imp);
    }
  }

  const riskLevel = (): 'low' | 'medium' | 'high' => {
    if (depMap.targetFiles.length === 1) return 'low';
    const affected = depMap.targetFiles.length + transitives.size;
    if (affected <= 3) return 'medium';
    return 'high';
  };

  return {
    filesDirectlyAffected: depMap.targetFiles.length,
    filesTransitivelyAffected: transitives.size,
    externalDependenciesChanged: depMap.externalDependencies,
    riskLevel: riskLevel(),
  };
}
