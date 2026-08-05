export type TechCategory = 'language' | 'framework' | 'engine' | 'tool' | 'asset' | 'runtime';

export type IssueSeverity = 'error' | 'warning' | 'info';

export type FileIndex = Record<string, string>;

export interface DetectedTechnology {
  readonly name: string;
  readonly category: TechCategory;
  readonly confidence: number;
  readonly evidence: readonly string[];
}

export interface DependencyNode {
  readonly id: string;
  readonly path: string;
}

export interface DependencyEdge {
  readonly source: string;
  readonly target: string;
}

export interface DependencyGraph {
  readonly nodes: readonly DependencyNode[];
  readonly edges: readonly DependencyEdge[];
  readonly circularDependencies: readonly (readonly string[])[];
  readonly isolatedModules: readonly string[];
}

export interface ArchitecturePattern {
  readonly name: string;
  readonly description: string;
  readonly confidence: number;
  readonly evidence: readonly string[];
}

export interface AssetInventory {
  readonly models: number;
  readonly textures: number;
  readonly shaders: number;
  readonly animations: number;
  readonly audio: number;
  readonly other: number;
  readonly locations: readonly string[];
}

export interface HealthIssue {
  readonly severity: IssueSeverity;
  readonly category: string;
  readonly message: string;
  readonly location?: string;
  readonly suggestion?: string;
}

export interface HealthReport {
  readonly score: number;
  readonly totalFiles: number;
  readonly totalDirs: number;
  readonly oversizedFiles: readonly string[];
  readonly issues: readonly HealthIssue[];
  readonly warnings: readonly string[];
  readonly recommendations: readonly string[];
}

export interface SymbolEntry {
  readonly name: string;
  readonly kind: 'class' | 'interface' | 'function' | 'variable' | 'type' | 'export';
  readonly filePath: string;
}

export interface ProjectContext {
  readonly workspacePath: string;
  readonly summary: {
    readonly totalFiles: number;
    readonly totalDirs: number;
    readonly configFiles: readonly string[];
    readonly packageManagers: readonly string[];
    readonly buildSystems: readonly string[];
    readonly gitDetected: boolean;
    readonly readmeSummary?: string | undefined;
  };
  readonly technologies: readonly DetectedTechnology[];
  readonly projectStructure: readonly DirectoryNode[];
  readonly dependencyGraph: DependencyGraph;
  readonly architecture: readonly ArchitecturePattern[];
  readonly assets: AssetInventory;
  readonly health: HealthReport;
  readonly symbols?: readonly SymbolEntry[] | undefined;
  /** Structured project metadata (name/version/license/package manager). */
  readonly metadata?: ProjectMetadataInfo | undefined;
  /** Detected entry files. */
  readonly entryFiles?: readonly string[] | undefined;
  /** The Project Scanner projection. */
  readonly scan?: ScanResult | undefined;
  /** The Folder Indexer projection. */
  readonly folders?: FolderIndex | undefined;
  /** The Dependency Analyzer projection. */
  readonly dependencies?: DependencyIndex | undefined;
  /** The Source Analyzer projection. */
  readonly source?: SourceIndex | undefined;
  /** Aggregate project statistics. */
  readonly statistics?: Statistics | undefined;
  readonly scanTimestamp: string;
}

export interface DirectoryNode {
  readonly name: string;
  readonly path: string;
  readonly type: 'directory' | 'file';
  readonly children?: readonly DirectoryNode[];
  readonly fileCount?: number;
}

export interface TechSignature {
  readonly name: string;
  readonly category: TechCategory;
  readonly detect: (files: FileIndex) => {
    detected: boolean;
    confidence: number;
    evidence: string[];
  };
}

// --- Project Scanner ---------------------------------------------------------

/** Package managers recognized by the scanner. */
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'cargo' | 'unknown';

/** Build tools recognized by the scanner. */
export type BuildTool =
  | 'vite'
  | 'webpack'
  | 'rollup'
  | 'esbuild'
  | 'tsup'
  | 'turbo'
  | 'cargo'
  | 'cmake'
  | 'gradle'
  | 'maven'
  | 'unknown';

export interface ScriptEntry {
  readonly name: string;
  readonly command: string;
}

export interface GitRepositoryInfo {
  readonly detected: boolean;
  /** Path (project-relative) where the repository marker was found. */
  readonly root?: string;
  readonly evidence: readonly string[];
}

export interface EnvironmentInfo {
  readonly detected: boolean;
  /** Paths of environment/config files that carry runtime variables. */
  readonly files: readonly string[];
  /** Variable names declared in the detected env files. */
  readonly variables: readonly string[];
}

/**
 * Output of the {@link import('./scanner/ProjectScanner') ProjectScanner}.
 * The single, structured answer to "what kind of project is this?" — computed
 * before any LLM call so Nova understands the project it is about to discuss.
 */
export interface ScanResult {
  /** The absolute (or given) root directory of the project. */
  readonly rootDirectory: string;
  readonly packageManager: PackageManager;
  /** All package managers with evidence (lockfiles, manifests). */
  readonly packageManagers: readonly string[];
  /** Primary framework (highest-confidence framework technology). */
  readonly framework: string;
  readonly frameworks: readonly string[];
  /** Primary language (highest-confidence language technology). */
  readonly language: string;
  readonly languages: readonly string[];
  readonly buildTool: BuildTool;
  readonly buildTools: readonly string[];
  /** npm/yarn/pnpm `scripts` from the root package.json. */
  readonly scripts: readonly ScriptEntry[];
  readonly gitRepository: GitRepositoryInfo;
  readonly environment: EnvironmentInfo;
  /** Candidate entry files discovered from manifests and conventions. */
  readonly entryFiles: readonly string[];
}

// --- Folder Indexer ----------------------------------------------------------

export interface ExtensionCount {
  readonly extension: string;
  readonly count: number;
}

/**
 * Output of the {@link import('./indexer/FolderIndexer') FolderIndexer}.
 * A full in-memory index of the project's folders, files, extensions, and
 * asset inventory.
 */
export interface FolderIndex {
  readonly folders: readonly string[];
  readonly files: readonly string[];
  readonly extensions: readonly ExtensionCount[];
  readonly assets: AssetInventory;
  readonly tree: readonly DirectoryNode[];
}

// --- Dependency Analyzer -----------------------------------------------------

export interface PackageManifest {
  readonly path: string;
  readonly name?: string;
  readonly version?: string;
  readonly description?: string;
  readonly license?: string;
  readonly packageManager?: string;
  readonly scripts: readonly ScriptEntry[];
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly optionalDependencies: Readonly<Record<string, string>>;
  /** Workspace globs declared in `package.json` (`workspaces`). */
  readonly workspaces: readonly string[];
  readonly main?: string;
  readonly module?: string;
  readonly types?: string;
  readonly engines?: Readonly<Record<string, string>>;
}

export interface WorkspacePackage {
  readonly name: string;
  /** Project-relative path of the workspace package root. */
  readonly path: string;
  readonly root: boolean;
}

/**
 * Output of the {@link import('./dependency/DependencyAnalyzer') DependencyAnalyzer}.
 * The manifest-level dependency picture of the project, including workspace
 * packages declared via `package.json` workspaces or `pnpm-workspace.yaml`.
 */
export interface DependencyIndex {
  readonly manifests: readonly PackageManifest[];
  /** The manifest at the project root, when one exists. */
  readonly rootManifest?: PackageManifest;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly optionalDependencies: Readonly<Record<string, string>>;
  readonly workspacePackages: readonly WorkspacePackage[];
  readonly packageManagers: readonly string[];
  readonly packageManager?: PackageManager;
  readonly lockfiles: readonly string[];
}

// --- Source Analyzer ---------------------------------------------------------

export interface SourceFileAnalysis {
  readonly path: string;
  readonly imports: readonly string[];
  readonly exports: readonly string[];
  readonly classes: readonly string[];
  readonly interfaces: readonly string[];
  readonly functions: readonly string[];
  readonly types: readonly string[];
  readonly symbols: readonly SymbolEntry[];
}

export interface SymbolGraphEdge {
  /** Source file path (project-relative). */
  readonly from: string;
  /** Target file path (project-relative). */
  readonly to: string;
  /** The imported symbol, when the edge is a named import. */
  readonly symbol?: string;
}

export interface SymbolGraph {
  readonly nodes: readonly string[];
  readonly edges: readonly SymbolGraphEdge[];
}

export interface PublicAPI {
  readonly names: readonly string[];
  /** Exported symbol name → source files that export it. */
  readonly files: Readonly<Record<string, readonly string[]>>;
}

/**
 * Output of the {@link import('./source/SourceAnalyzer') SourceAnalyzer}.
 * A symbol-level view of the project's source: classes, interfaces, functions,
 * types, exports, imports, a module graph, and the public API surface.
 */
export interface SourceIndex {
  readonly files: readonly SourceFileAnalysis[];
  readonly totalImports: number;
  readonly totalExports: number;
  readonly classes: readonly SymbolEntry[];
  readonly interfaces: readonly SymbolEntry[];
  readonly functions: readonly SymbolEntry[];
  readonly types: readonly SymbolEntry[];
  readonly symbols: readonly SymbolEntry[];
  readonly graph: SymbolGraph;
  readonly publicApi: PublicAPI;
}

// --- Project Summary / Statistics --------------------------------------------

export interface Statistics {
  readonly totalFiles: number;
  readonly totalDirs: number;
  readonly sourceFiles: number;
  readonly assetFiles: number;
  readonly linesOfCode: number;
  readonly byExtension: readonly ExtensionCount[];
}

export interface ProjectMetadataInfo {
  readonly name?: string;
  readonly version?: string;
  readonly description?: string;
  readonly license?: string;
  readonly packageManager?: string;
}

// --- Incremental Cache -------------------------------------------------------

/** A content fingerprint of a scanned project (path → hash). */
export interface ProjectFingerprint {
  readonly paths: readonly string[];
  readonly hashes: Readonly<Record<string, string>>;
  readonly totalBytes: number;
}

/** The cached, immutable result of a scan for one project. */
export interface IndexedSnapshot<TContext> {
  readonly rootPath: string;
  readonly fingerprint: ProjectFingerprint;
  readonly context: TContext;
  readonly updatedAt: number;
}

/** The diff produced when syncing a fresh scan against the cache. */
export interface FileDelta {
  readonly added: readonly string[];
  readonly changed: readonly string[];
  readonly removed: readonly string[];
  readonly unchanged: readonly string[];
  readonly changedCount: number;
}
