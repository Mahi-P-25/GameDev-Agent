/**
 * Nova Runtime Layer — public surface.
 * ===========================================================================
 *
 * The Runtime connects Nova to the *real* development environment. Every provider
 * (Git, Terminal, Filesystem, Workspace, Build, Test, Package, Process) exposes
 * a common contract — `status`, `events`, `health`, `capabilities` — and every
 * real observation becomes a Studio Event on the shared Event Bus. Nothing is
 * guessed; Nova reports only what the Runtime actually observed.
 *
 * Two kernel modules are exported:
 *  - {@link runtimeModule}     — browser-safe (refuses process execution).
 *  - {@link runtimeNodeModule} — backend (real `node:child_process` execution).
 *
 * Both register the same {@link RUNTIME_TOKEN}, so agents, the planner, and the
 * Command Center resolve one `Runtime` and stay architecture-clean.
 */

// --- core types -------------------------------------------------------------
export type {
  RuntimeProvider,
  ProviderStatus,
  ProviderHealth,
  ProviderStatusState,
  ProviderCapability,
  RuntimeProviderId,
} from './types';

// --- executor seam ----------------------------------------------------------
export { browserExecutor, BrowserExecutorError, nullLogger } from './executor';
export type { ProcessExecutor, ExecOptions, ExecResult } from './executor';

// --- providers --------------------------------------------------------------
export { BaseProvider } from './BaseProvider';
export { GitProvider } from './GitProvider';
export type { GitCapabilityId, GitProviderStatus } from './GitProvider';
export { TerminalProvider } from './TerminalProvider';
export type {
  TerminalCapabilityId,
  TerminalProviderStatus,
  TerminalSession,
} from './TerminalProvider';
export { FilesystemProvider } from './FilesystemProvider';
export type { FilesystemCapabilityId, FilesystemProviderStatus } from './FilesystemProvider';
export { WorkspaceProvider } from './WorkspaceProvider';
export type { WorkspaceCapabilityId, WorkspaceProviderStatus } from './WorkspaceProvider';
export { BuildProvider } from './BuildProvider';
export type { BuildCapabilityId, BuildProviderStatus } from './BuildProvider';
export { TestProvider } from './TestProvider';
export type { TestCapabilityId, TestProviderStatus } from './TestProvider';
export { PackageProvider } from './PackageProvider';
export type { PackageCapabilityId, PackageProviderStatus } from './PackageProvider';
export { ProcessProvider } from './ProcessProvider';
export type { ProcessCapabilityId, ProcessProviderStatus } from './ProcessProvider';

// --- aggregate --------------------------------------------------------------
export { Runtime } from './Runtime';
export type { RuntimeBuildConfig, RuntimeTestConfig } from './Runtime';

// --- module + tokens --------------------------------------------------------
export { runtimeModule, RUNTIME_TOKEN } from './RuntimeModule';

// --- events -----------------------------------------------------------------
export {
  GitCommit,
  GitStatus,
  GitBranchChanged,
  TerminalSessionStarted,
  TerminalSessionEnded,
  FilesystemChanged,
  FileOpened,
  WorkspaceChanged,
  BuildStarted,
  BuildSucceeded,
  BuildFailed,
  BuildCanceled,
  TestRunStarted,
  TestRunPassed,
  TestRunFailed,
  PackageInstalled,
  PackageRemoved,
  PackageUpdated,
  PackageAudited,
  ProcessSpawned,
  ProcessExited,
} from './RuntimeEvents';
export type {
  RuntimeEventBase,
  GitCommitPayload,
  GitStatusPayload,
  GitBranchChangedPayload,
  TerminalSessionStartedPayload,
  TerminalSessionEndedPayload,
  FilesystemChangedPayload,
  FileOpenedPayload,
  WorkspaceChangedPayload,
  BuildState,
  BuildPayload,
  TestState,
  TestRunPayload,
  PackageState,
  PackageEventPayload,
  ProcessSpawnedPayload,
  ProcessExitedPayload,
  PackageManagerKind,
  RuntimeEventPayloads,
} from './RuntimeEvents';
