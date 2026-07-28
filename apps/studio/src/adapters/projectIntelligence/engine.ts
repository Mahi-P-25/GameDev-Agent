import type { FileIndex, ProjectContext } from './types';
import { detectTechnologies } from './techDetector';
import { analyzeStructure } from './structAnalyzer';
import { analyzeDependencies } from './depAnalyzer';
import { detectArchitecture } from './archDetector';
import { scanAssets } from './assetScanner';
import { analyzeHealth, scanDirectory } from './healthAnalyzer';
import type { WorkspaceScanner } from './scanner';
import { ViteGlobScanner } from './scanner';

export class ProjectIntelligenceEngine {
  private scanner: WorkspaceScanner;
  private cache: ProjectContext | null = null;
  private cachedPath: string = '';

  constructor(scanner?: WorkspaceScanner) {
    this.scanner = scanner ?? new ViteGlobScanner();
  }

  async scanWorkspace(workspacePath?: string): Promise<ProjectContext> {
    const normalizedPath = workspacePath ?? '.';
    if (this.cache && this.cachedPath === normalizedPath) {
      return this.cache;
    }

    const files = await this.scanner.scan();
    const dirScan = scanDirectory(Object.keys(files));

    const technologies = detectTechnologies(files);
    const projectStructure = analyzeStructure(files);
    const dependencyGraph = analyzeDependencies(files);
    const architecture = detectArchitecture(files);
    const assets = scanAssets(files);
    const health = analyzeHealth(files);

    const ctx: ProjectContext = {
      workspacePath: normalizedPath,
      summary: {
        totalFiles: health.totalFiles,
        totalDirs: health.totalDirs,
        configFiles: dirScan.configFiles,
        packageManagers: dirScan.packageManagers,
        buildSystems: dirScan.buildSystems,
      },
      technologies,
      projectStructure,
      dependencyGraph,
      architecture,
      assets,
      health,
      scanTimestamp: new Date().toISOString(),
    };

    this.cache = ctx;
    this.cachedPath = normalizedPath;
    return ctx;
  }

  invalidateCache(): void {
    this.cache = null;
    this.cachedPath = '';
  }

  async scanWithData(fileIndex: FileIndex): Promise<ProjectContext> {
    const dirScan = scanDirectory(Object.keys(fileIndex));

    return {
      workspacePath: '.',
      summary: {
        totalFiles: Object.keys(fileIndex).length,
        totalDirs: dirScan.totalDirs,
        configFiles: dirScan.configFiles,
        packageManagers: dirScan.packageManagers,
        buildSystems: dirScan.buildSystems,
      },
      technologies: detectTechnologies(fileIndex),
      projectStructure: analyzeStructure(fileIndex),
      dependencyGraph: analyzeDependencies(fileIndex),
      architecture: detectArchitecture(fileIndex),
      assets: scanAssets(fileIndex),
      health: analyzeHealth(fileIndex),
      scanTimestamp: new Date().toISOString(),
    };
  }
}
