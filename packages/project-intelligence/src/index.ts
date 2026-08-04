/**
 * Nova Studio Project Intelligence — public surface.
 * ===========================================================================
 *
 * The Project Intelligence layer turns "a project is open" into usable metadata:
 * it loads the project's workspace, indexes the project's files through the
 * Filesystem tool seam, and derives the file tree, framework/language, package
 * manager, and dependency graph — cached per project and served to the Studio.
 *
 * What you get:
 *  - {@link ProjectIntelligenceManager} — the kernel service: reacts to
 *    `project.opened`, loads the workspace, indexes, caches, publishes.
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
export { ProjectIntelligenceIndexed, ProjectIntelligenceError } from './ProjectIntelligenceEvents';
export type {
  ProjectIntelligenceIndexedPayload,
  ProjectIntelligenceErrorPayload,
} from './ProjectIntelligenceEvents';

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
} from './types';
