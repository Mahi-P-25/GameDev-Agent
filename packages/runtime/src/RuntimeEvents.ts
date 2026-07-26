/**
 * Nova Runtime — event catalog.
 * ===========================================================================
 *
 * Every concrete observation a provider makes becomes a typed Studio Event on the
 * shared Event Bus. The UI, the Intelligence layer, and the Agent Activity log
 * all subscribe to this single pipeline. Nothing is invented: a Git Commit only
 * exists because `GitProvider` observed `git` produce one; a Build Failed only
 * exists because `BuildProvider` observed a non-zero exit.
 *
 * Naming: `<aggregate>.<pastTenseVerb>` (e.g. `git.commit`, `build.failed`).
 * Every payload carries `correlationId` and `timestamp` so events are
 * replayable and correlatable by consumers.
 *
 * There is deliberately NO `*.thinking` / `*.guessed` event: the Runtime never
 * fabricates activity.
 */

export interface RuntimeEventBase {
  /** The workspace/root the event was observed in (absolute path). */
  readonly workspaceRoot: string;
  /** Correlation across the pipeline (links related runtime + intelligence events). */
  readonly correlationId: string | null;
  /** Observation time (epoch ms). */
  readonly timestamp: number;
}

// --- Git --------------------------------------------------------------------

export interface GitCommitPayload extends RuntimeEventBase {
  readonly hash: string;
  readonly message: string;
  readonly author: string;
  readonly branch: string;
}

export interface GitStatusPayload extends RuntimeEventBase {
  readonly branch: string;
  readonly dirty: boolean;
  readonly staged: ReadonlyArray<string>;
  readonly unstaged: ReadonlyArray<string>;
  readonly untracked: ReadonlyArray<string>;
  readonly ahead: number;
  readonly behind: number;
}

export interface GitBranchChangedPayload extends RuntimeEventBase {
  readonly from: string | null;
  readonly to: string;
}

// --- Terminal ----------------------------------------------------------------

export interface TerminalSessionStartedPayload extends RuntimeEventBase {
  readonly sessionId: string;
  readonly command: string;
}

export interface TerminalSessionEndedPayload extends RuntimeEventBase {
  readonly sessionId: string;
  readonly exitCode: number | null;
  readonly command: string;
}

// --- Filesystem --------------------------------------------------------------

export interface FilesystemChangedPayload extends RuntimeEventBase {
  readonly path: string;
  readonly kind: 'created' | 'modified' | 'deleted' | 'renamed';
  readonly correlatedFile?: string;
}

export interface FileOpenedPayload extends RuntimeEventBase {
  readonly path: string;
}

// --- Workspace ---------------------------------------------------------------

export interface WorkspaceChangedPayload extends RuntimeEventBase {
  readonly projectName: string | null;
  readonly packageManager: PackageManagerKind;
  readonly reason: 'project-switched' | 'config-changed' | 'git-branch' | 'initialized';
}

// --- Build ------------------------------------------------------------------

export type BuildState = 'started' | 'succeeded' | 'failed' | 'canceled';

export interface BuildPayload extends RuntimeEventBase {
  readonly buildId: string;
  readonly state: BuildState;
  readonly target: string;
  /** Non-empty only when `state` is `failed`. A real reason, never fabricated. */
  readonly failureReason?: string;
  readonly durationMs?: number;
}

// --- Test -------------------------------------------------------------------

export type TestState = 'started' | 'passed' | 'failed';

export interface TestRunPayload extends RuntimeEventBase {
  readonly runId: string;
  readonly state: TestState;
  readonly passed: number;
  readonly failed: number;
  readonly total: number;
  readonly failureSummary?: string;
  readonly durationMs?: number;
}

// --- Package ----------------------------------------------------------------

export type PackageState = 'installed' | 'removed' | 'updated' | 'audit';

export interface PackageEventPayload extends RuntimeEventBase {
  readonly manager: PackageManagerKind;
  readonly state: PackageState;
  readonly spec: string;
  readonly detail?: string;
}

// --- Process ----------------------------------------------------------------

export interface ProcessSpawnedPayload extends RuntimeEventBase {
  readonly pid: number;
  readonly command: string;
  readonly args: ReadonlyArray<string>;
}

export interface ProcessExitedPayload extends RuntimeEventBase {
  readonly pid: number;
  readonly exitCode: number | null;
}

/** The package managers the Runtime can recognize and drive. */
export type PackageManagerKind = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';

// --- Event definitions -------------------------------------------------------

function define<T>(type: string): import('@gamedev-agent/events').EventDefinition<T> {
  return { type, version: 1 };
}

export const GitCommit = define<GitCommitPayload>('git.commit');
export const GitStatus = define<GitStatusPayload>('git.status');
export const GitBranchChanged = define<GitBranchChangedPayload>('git.branch-changed');

export const TerminalSessionStarted = define<TerminalSessionStartedPayload>(
  'terminal.session-started',
);
export const TerminalSessionEnded = define<TerminalSessionEndedPayload>('terminal.session-ended');

export const FilesystemChanged = define<FilesystemChangedPayload>('filesystem.changed');
export const FileOpened = define<FileOpenedPayload>('filesystem.file-opened');

export const WorkspaceChanged = define<WorkspaceChangedPayload>('workspace.changed');

export const BuildStarted = define<BuildPayload>('build.started');
export const BuildSucceeded = define<BuildPayload>('build.succeeded');
export const BuildFailed = define<BuildPayload>('build.failed');
export const BuildCanceled = define<BuildPayload>('build.canceled');

export const TestRunStarted = define<TestRunPayload>('test.started');
export const TestRunPassed = define<TestRunPayload>('test.passed');
export const TestRunFailed = define<TestRunPayload>('test.failed');

export const PackageInstalled = define<PackageEventPayload>('package.installed');
export const PackageRemoved = define<PackageEventPayload>('package.removed');
export const PackageUpdated = define<PackageEventPayload>('package.updated');
export const PackageAudited = define<PackageEventPayload>('package.audit');

export const ProcessSpawned = define<ProcessSpawnedPayload>('process.spawned');
export const ProcessExited = define<ProcessExitedPayload>('process.exited');

/** Union of every runtime event payload — useful for consumers and replay. */
export type RuntimeEventPayloads =
  | GitCommitPayload
  | GitStatusPayload
  | GitBranchChangedPayload
  | TerminalSessionStartedPayload
  | TerminalSessionEndedPayload
  | FilesystemChangedPayload
  | FileOpenedPayload
  | WorkspaceChangedPayload
  | BuildPayload
  | TestRunPayload
  | PackageEventPayload
  | ProcessSpawnedPayload
  | ProcessExitedPayload;
