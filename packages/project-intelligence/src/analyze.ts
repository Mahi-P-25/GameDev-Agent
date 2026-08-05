import { detectArchitecture } from './analyzers/archDetector';
import { scanAssets } from './analyzers/assetScanner';
import { analyzeDependencies } from './analyzers/depAnalyzer';
import { analyzeHealth, scanDirectory } from './analyzers/healthAnalyzer';
import { analyzeStructure } from './analyzers/structAnalyzer';
import { detectTechnologies } from './analyzers/techDetector';
import { DependencyAnalyzer } from './dependency/DependencyAnalyzer';
import { FolderIndexer } from './indexer/FolderIndexer';
import { ProjectScanner } from './scanner/ProjectScanner';
import { extensionOf } from './shared/paths';
import { SourceAnalyzer } from './source/SourceAnalyzer';
import type { FileIndex, ProjectContext, ProjectMetadataInfo, Statistics } from './types';

/**
 * Parses README content from file index into a clean summary excerpt.
 */
function extractReadmeSummary(files: FileIndex): string | undefined {
  const readmeKey = Object.keys(files).find(
    (f) => f.toLowerCase() === 'readme.md' || f.toLowerCase() === 'readme',
  );
  if (readmeKey === undefined) return undefined;
  const content = files[readmeKey]?.trim();
  if (content === undefined || content === '') return undefined;
  // Get first non-empty 300 characters
  return content.slice(0, 300).replace(/\n+/g, ' ');
}

/**
 * Compose the shared analyzers into a {@link ProjectContext} for a project
 * rooted at `workspacePath`. This is the single projection used by both the
 * kernel service and the Studio UI — one source of truth for how a project's
 * file index becomes Project Intelligence.
 */
export function analyzeProject(files: FileIndex, workspacePath: string): ProjectContext {
  const dirScan = scanDirectory(Object.keys(files));

  const scanner = new ProjectScanner(workspacePath);
  const scan = scanner.scan(files);
  const folders = new FolderIndexer().index(files);
  const dependencies = new DependencyAnalyzer().analyze(files);
  const source = new SourceAnalyzer().analyze(files);

  const readmeSummary = extractReadmeSummary(files);
  const statistics = computeStatistics(files, folders.files.length, folders.folders.length, source);
  const metadata = computeMetadata(dependencies.rootManifest);

  return {
    workspacePath,
    summary: {
      totalFiles: Object.keys(files).length,
      totalDirs: dirScan.totalDirs,
      configFiles: dirScan.configFiles,
      packageManagers: dirScan.packageManagers,
      buildSystems: dirScan.buildSystems,
      gitDetected: scan.gitRepository.detected,
      ...(readmeSummary !== undefined ? { readmeSummary } : {}),
    },
    technologies: detectTechnologies(files),
    projectStructure: analyzeStructure(files),
    dependencyGraph: analyzeDependencies(files),
    architecture: detectArchitecture(files),
    assets: scanAssets(files),
    health: analyzeHealth(files),
    symbols: source.symbols.slice(0, 50),
    metadata,
    entryFiles: scan.entryFiles,
    scan,
    folders,
    dependencies,
    source,
    statistics,
    scanTimestamp: new Date().toISOString(),
  };
}

function computeStatistics(
  files: FileIndex,
  totalFiles: number,
  totalDirs: number,
  source: ReturnType<SourceAnalyzer['analyze']>,
): Statistics {
  let linesOfCode = 0;
  for (const analysis of source.files) {
    linesOfCode += (files[analysis.path] ?? '').split('\n').length;
  }
  return {
    totalFiles,
    totalDirs,
    sourceFiles: source.files.length,
    assetFiles: countAssetFilesFromExtensions(files),
    linesOfCode,
    byExtension: aggregateExtensions(files),
  };
}

function aggregateExtensions(files: FileIndex): Statistics['byExtension'] {
  const counts = new Map<string, number>();
  for (const path of Object.keys(files)) {
    const extension = extensionOf(path) || '(none)';
    counts.set(extension, (counts.get(extension) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([extension, count]) => ({ extension, count }))
    .sort((a, b) => b.count - a.count || a.extension.localeCompare(b.extension));
}

function countAssetFilesFromExtensions(files: FileIndex): number {
  const assets = scanAssets(files);
  return (
    assets.models +
    assets.textures +
    assets.shaders +
    assets.animations +
    assets.audio +
    assets.other
  );
}

function computeMetadata(
  rootManifest: ReturnType<DependencyAnalyzer['analyze']>['rootManifest'],
): ProjectMetadataInfo {
  if (rootManifest === undefined) {
    return {};
  }
  return {
    ...(rootManifest.name !== undefined ? { name: rootManifest.name } : {}),
    ...(rootManifest.version !== undefined ? { version: rootManifest.version } : {}),
    ...(rootManifest.description !== undefined ? { description: rootManifest.description } : {}),
    ...(rootManifest.license !== undefined ? { license: rootManifest.license } : {}),
    ...(rootManifest.packageManager !== undefined
      ? { packageManager: rootManifest.packageManager }
      : {}),
  };
}
