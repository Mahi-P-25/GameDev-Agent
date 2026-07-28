export interface StructuredGoal {
  readonly projectName: string;
  readonly framework: string;
  readonly language: string;
  readonly bundler: string;
  readonly raw: string;
}

export interface Task {
  readonly id: string;
  readonly label: string;
  readonly toolId: string;
  readonly action: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly timeoutMs: number;
  readonly dependsOn: ReadonlyArray<string>;
}

export interface TaskResult {
  readonly taskId: string;
  readonly success: boolean;
  readonly output: Readonly<Record<string, unknown>> | null;
  readonly durationMs: number;
  readonly error: string | null;
}

export type MissionStatus = 'completed' | 'failed';

export interface MissionResult {
  readonly status: MissionStatus;
  readonly goal: StructuredGoal;
  readonly taskResults: ReadonlyArray<TaskResult>;
  readonly totalDurationMs: number;
  readonly summary: string;
  readonly failedTask: Task | null;
  readonly failureDiagnosis: string | null;
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export class UnsupportedGoalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedGoalError';
  }
}

// ─── Project Intelligence Types ───────────────────────────────────────

export interface SourceFile {
  readonly path: string;
  readonly imports: ReadonlyArray<string>;
  readonly exports: ReadonlyArray<string>;
  readonly systems: ReadonlyArray<string>;
}

export interface ImportGraph {
  readonly nodes: ReadonlyArray<string>;
  readonly edges: ReadonlyArray<[string, string]>;
}

export interface DetectedSystem {
  readonly name: string;
  readonly files: ReadonlyArray<string>;
  readonly description: string;
}

export interface SourceInfo {
  readonly fileCount: number;
  readonly files: ReadonlyArray<SourceFile>;
  readonly importGraph: ImportGraph;
  readonly entryPoints: ReadonlyArray<string>;
  readonly systems: ReadonlyArray<DetectedSystem>;
}

export interface Asset {
  readonly path: string;
  readonly name: string;
  readonly format: string;
  readonly sizeBytes: number;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface MissingReference {
  readonly source: string;
  readonly reference: string;
  readonly type: 'texture' | 'model' | 'unknown';
}

export interface AssetInfo {
  readonly models: ReadonlyArray<Asset>;
  readonly textures: ReadonlyArray<Asset>;
  readonly materials: ReadonlyArray<Asset>;
  readonly shaders: ReadonlyArray<Asset>;
  readonly audio: ReadonlyArray<Asset>;
  readonly animations: ReadonlyArray<Asset>;
  readonly missingReferences: ReadonlyArray<MissingReference>;
}

export interface ArchitectureInfo {
  readonly pattern: string;
  readonly managers: ReadonlyArray<string>;
  readonly services: ReadonlyArray<string>;
  readonly controllers: ReadonlyArray<string>;
  readonly components: ReadonlyArray<string>;
  readonly systems: ReadonlyArray<string>;
  readonly description: string;
}

export interface RepoInfo {
  readonly packageManager: string | null;
  readonly framework: string | null;
  readonly language: string | null;
  readonly buildSystem: string | null;
  readonly isGitRepo: boolean;
  readonly gitBranch: string | null;
}

export interface ProjectContext {
  readonly projectPath: string;
  readonly repo: RepoInfo;
  readonly source: SourceInfo;
  readonly assets: AssetInfo;
  readonly architecture: ArchitectureInfo;
  readonly scannedAt: string;
}
