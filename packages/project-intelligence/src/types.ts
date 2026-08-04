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
