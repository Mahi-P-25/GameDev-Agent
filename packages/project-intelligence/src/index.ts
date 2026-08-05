/**
 * Nova Studio Project Intelligence — public surface.
 * ===========================================================================
 *
 * The Project Intelligence layer turns "a project is open" into usable metadata:
 * it loads the project's workspace, indexes the project's files through the
 * Filesystem tool seam, and derives the file tree, framework/language, package
 * manager, and dependency graph — cached per project and served to the Studio.
 *
 * The engine is composed of four analyzers that feed a single projection:
 *  - {@link ProjectScanner}    — package manager, framework, language, build
 *    tool, scripts, git, environment, root directory.
 *  - {@link FolderIndexer}     — folders, files, extensions, assets, in-memory
 *    tree.
 *  - {@link DependencyAnalyzer}— package.json, dependencies, dev/peer
 *    dependencies, workspace packages.
 *  - {@link SourceAnalyzer}    — classes, interfaces, functions, types,
 *    exports, imports, symbol graph, public API.
 *  - {@link ProjectSummarizer} — composes everything into a
 *    {@link ProjectContext} and drives the incremental {@link ProjectIndexCache}.
 *
 * What you get:
 *  - {@link ProjectIntelligenceManager} — the kernel service: reacts to
 *    `project.opened`, loads the workspace, indexes, caches, and publishes the
 *    `project.index.*` lifecycle events.
 *  - {@link ProjectIndexer}             — walks a project root through the
 *    Filesystem tool (`files.list` / `files.read`), independent of the FS impl.
 *  - {@link analyzeProject}            — composes the analyzers into a
 *    {@link ProjectContext} (the single projection the Studio renders).
 *  - The shared analyzers              — tech detection, structure, dependencies,
 *    architecture, assets, and health.
 *  - {@link projectIntelligenceModule} — the Kernel module that installs the layer.
 *  - Types & events                    — the stable contracts integrations build against.
 */

export { ProjectIndexer } from './ProjectIndexer';
export { ProjectIntelligenceManager } from './ProjectIntelligenceManager';
export type {
  ProjectIntelligenceManagerOptions,
  ProjectIndexerLike,
} from './ProjectIntelligenceManager';
export {
  projectIntelligenceModule,
  PROJECT_INTELLIGENCE_TOKEN,
} from './ProjectIntelligenceModule';
export { analyzeProject } from './analyze';

// --- Events ------------------------------------------------------------------
export {
  ProjectIntelligenceIndexed,
  ProjectIntelligenceError,
  ProjectIndexStarted,
  ProjectIndexProgress,
  ProjectIndexCompleted,
  ProjectIndexFailed,
} from './ProjectIntelligenceEvents';
export type {
  ProjectIntelligenceIndexedPayload,
  ProjectIntelligenceErrorPayload,
  ProjectIndexStartedPayload,
  ProjectIndexProgressPayload,
  ProjectIndexCompletedPayload,
  ProjectIndexFailedPayload,
  IndexStage,
} from './ProjectIntelligenceEvents';

// --- Analyzers ---------------------------------------------------------------
export { ProjectScanner, scanProject } from './scanner/ProjectScanner';
export { FolderIndexer, indexFolders } from './indexer/FolderIndexer';
export { DependencyAnalyzer, analyzeDependencyIndex } from './dependency/DependencyAnalyzer';
export { SourceAnalyzer, analyzeSource } from './source/SourceAnalyzer';
export { ProjectSummarizer } from './summarizer/ProjectSummarizer';
export type {
  SummarizeResult,
  ProjectSummarizerOptions,
} from './summarizer/ProjectSummarizer';
export { ProjectIndexCache } from './cache/ProjectIndexCache';
export type { ProjectIndexCacheOptions } from './cache/ProjectIndexCache';

// --- Shared manifest utilities ----------------------------------------------
export {
  findPackageManifests,
  parsePackageManifest,
  entryScripts,
} from './shared/packageJson';

export * from './analyzers';

export type {
  TechCategory,
  IssueSeverity,
  FileIndex,
  DetectedTechnology,
  DependencyNode,
  DependencyEdge,
  DependencyGraph,
  ArchitecturePattern,
  AssetInventory,
  HealthIssue,
  HealthReport,
  SymbolEntry,
  ProjectContext,
  DirectoryNode,
  TechSignature,
  PackageManager,
  BuildTool,
  ScriptEntry,
  GitRepositoryInfo,
  EnvironmentInfo,
  ScanResult,
  ExtensionCount,
  FolderIndex,
  PackageManifest,
  WorkspacePackage,
  DependencyIndex,
  SourceFileAnalysis,
  SymbolGraphEdge,
  SymbolGraph,
  PublicAPI,
  SourceIndex,
  Statistics,
  ProjectMetadataInfo,
  ProjectFingerprint,
  IndexedSnapshot,
  FileDelta,
} from './types';
