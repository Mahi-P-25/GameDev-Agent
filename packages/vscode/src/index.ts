/**
 * Nova VS Code Integration — the reference plugin.
 *
 * This is the **first real, non-stub integration** for Nova and the template
 * every future plugin (Git, Terminal, Browser, …) will follow. It bridges Nova
 * to a local VS Code workspace with a narrow, fully explicit, audited surface:
 *
 *  - **WorkspaceService** — open/close a workspace, own the root path, emit
 *    workspace lifecycle events.
 *  - **FileService** — list / read / write / create / rename / delete files.
 *    Every mutation is explicit and emits a typed event.
 *  - **SearchService** — search files by name (glob) and text by content.
 *    Strictly read-only.
 *  - **WatcherService** — watch the workspace and publish change events.
 *  - **VSCodeClient** — the façade that wires the four services together, exposes
 *    the ten capabilities, and audits every operation with an explicit actor +
 *    correlation id.
 *
 * Integration scope is deliberately narrow. The package talks to the rest of
 * Nova only through three seams: the **Event Bus** (publishes typed events),
 * the **Coordinator** (a read-only link correlating operations to missions), and
 * the **Studio API** (consumes the events this package emits — it never imports
 * studio-api internals). It performs no AI, never mutates files on its own, and
 * every file operation is explicit and auditable.
 */

// --- domain types & contracts ----------------------------------------------
export type {
  VSCodeWorkspaceId,
  VSCodeWorkspaceStatus,
  VSCodeEntryKind,
  VSCodeFileEntry,
  VSCodeFileContent,
  VSCodeFileCreated as VSCodeFileCreatedResult,
  VSCodeWorkspaceInfo,
  VSCodeAuditRecord,
  VSCodeAuditOperation,
  VSCodeActor,
  VSCodeClientOptions,
  CoordinatorLink,
  VSCodeWatcher,
  VSCodeFileChange,
  VSCodeChangeType,
  VSCodeTextMatch,
  VSCodeFileMatch,
  VSCodeSearchFilesOptions,
  VSCodeSearchTextOptions,
} from './VSCodeTypes';
export { asVSCodeWorkspaceId } from './VSCodeTypes';

// --- errors -----------------------------------------------------------------
export {
  VSCodeError,
  VSCodeWorkspaceClosedError,
  VSCodeWorkspaceOpenError,
  VSCodePathTraversalError,
  VSCodeNotFoundError,
  VSCodeAlreadyExistsError,
  VSCodeEntryKindError,
  VSCodeRejectedError,
  VSCodeTimeoutError,
  mapFsError,
} from './VSCodeErrors';

// --- events -----------------------------------------------------------------
export {
  VSCodeWorkspaceOpened,
  VSCodeWorkspaceClosed,
  VSCodeWorkspaceError,
  VSCodeFileRead,
  VSCodeFileWritten,
  VSCodeFileCreated as VSCodeFileCreatedEvent,
  VSCodeFileRenamed,
  VSCodeFileDeleted,
  VSCodeWatcherStarted,
  VSCodeWatcherStopped,
  VSCodeWorkspaceFileChanged,
} from './VSCodeEvents';
export type {
  VSCodeWorkspaceOpenedPayload,
  VSCodeWorkspaceClosedPayload,
  VSCodeWorkspaceErrorPayload,
  VSCodeFileEventPayload,
  VSCodeFileRenamedPayload,
  VSCodeFileDeletedPayload,
  VSCodeWatcherStartedPayload,
  VSCodeWatcherStoppedPayload,
  VSCodeWorkspaceFileChangedPayload,
  VSCodeEventPayloads,
} from './VSCodeEvents';

// --- services ---------------------------------------------------------------
export { WorkspaceService } from './WorkspaceService';
export type { WorkspaceServiceOptions } from './WorkspaceService';
export { FileService } from './FileService';
export type { FileServiceOptions } from './FileService';
export { SearchService, compileGlob } from './SearchService';
export { WatcherService } from './WatcherService';
export type { WatcherServiceOptions } from './WatcherService';

// --- client + kernel module -------------------------------------------------
export { VSCodeClient } from './VSCodeClient';
export { VSCODE_CLIENT_TOKEN, vscodeModule } from './VSCodeModule';
