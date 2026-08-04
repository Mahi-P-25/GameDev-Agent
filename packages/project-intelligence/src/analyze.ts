import { detectArchitecture } from './analyzers/archDetector';
import { scanAssets } from './analyzers/assetScanner';
import { analyzeDependencies } from './analyzers/depAnalyzer';
import { analyzeHealth, scanDirectory } from './analyzers/healthAnalyzer';
import { analyzeStructure } from './analyzers/structAnalyzer';
import { detectTechnologies } from './analyzers/techDetector';
import type { FileIndex, ProjectContext, SymbolEntry } from './types';

/**
 * Parses README content from file index into a clean summary excerpt.
 */
function extractReadmeSummary(files: FileIndex): string | undefined {
  const readmeKey = Object.keys(files).find(
    (f) => f.toLowerCase() === 'readme.md' || f.toLowerCase() === 'readme',
  );
  if (!readmeKey) return undefined;
  const content = files[readmeKey]?.trim();
  if (!content) return undefined;
  // Get first non-empty 300 characters
  return content.slice(0, 300).replace(/\n+/g, ' ');
}

/**
 * Scans exported symbols (classes, interfaces, functions, variables) across source files.
 */
function extractSymbolIndex(files: FileIndex): SymbolEntry[] {
  const symbols: SymbolEntry[] = [];
  const symbolRegex = /export\s+(class|interface|function|const|let|var|type)\s+([A-Za-z0-9_]+)/g;

  for (const [filePath, content] of Object.entries(files)) {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && !filePath.endsWith('.js')) {
      continue;
    }
    for (let match = symbolRegex.exec(content); match !== null; match = symbolRegex.exec(content)) {
      const kw = match[1];
      const name = match[2];
      if (typeof name !== 'string' || !name) continue;
      const kind: SymbolEntry['kind'] =
        kw === 'class'
          ? 'class'
          : kw === 'interface'
            ? 'interface'
            : kw === 'function'
              ? 'function'
              : kw === 'type'
                ? 'type'
                : 'export';
      symbols.push({ name, kind, filePath });
    }
  }

  return symbols.slice(0, 50); // Top 50 symbols
}

/**
 * Compose the shared analyzers into a {@link ProjectContext} for a project
 * rooted at `workspacePath`. This is the single projection used by both the
 * kernel service and the Studio UI — one source of truth for how a project's
 * file index becomes Project Intelligence.
 */
export function analyzeProject(files: FileIndex, workspacePath: string): ProjectContext {
  const dirScan = scanDirectory(Object.keys(files));
  const gitDetected = Object.keys(files).some(
    (f) => f.includes('.git') || f === '.gitignore' || f === '.gitattributes',
  );
  const readmeSummary = extractReadmeSummary(files);

  return {
    workspacePath,
    summary: {
      totalFiles: Object.keys(files).length,
      totalDirs: dirScan.totalDirs,
      configFiles: dirScan.configFiles,
      packageManagers: dirScan.packageManagers,
      buildSystems: dirScan.buildSystems,
      gitDetected,
      ...(readmeSummary !== undefined ? { readmeSummary } : {}),
    },
    technologies: detectTechnologies(files),
    projectStructure: analyzeStructure(files),
    dependencyGraph: analyzeDependencies(files),
    architecture: detectArchitecture(files),
    assets: scanAssets(files),
    health: analyzeHealth(files),
    symbols: extractSymbolIndex(files),
    scanTimestamp: new Date().toISOString(),
  };
}
