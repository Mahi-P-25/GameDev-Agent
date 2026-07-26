import type { EventDefinition } from '@gamedev-agent/events';
import type {
  VSCodeChangeType,
  VSCodeEntryKind,
  VSCodeWorkspaceId,
  VSCodeWorkspaceStatus,
} from './VSCodeTypes';

/**
 * Strongly-typed event catalog for the Nova VS Code integration.
 *
 * Following the Nova convention `<aggregate>.<pastTenseVerb>` (e.g.
 * `vscode.workspace-opened`), every meaningful state change emits a typed
 * {@link EventDefinition} (stable `type` + `version: 1`). Subscribers bind to
 * the definition, not a magic string, so payloads are fully inferred and the
 * compiler catches drift. The integration publishes these through the shared
 * Event Bus — it never calls other packages directly. This is how the Studio
 * API, Coordinator, Memory, and UI observe VS Code activity without the
 * integration depending on them.
 */

export interface VSCodeWorkspaceOpenedPayload {
  readonly workspaceId: VSCodeWorkspaceId;
  readonly rootPath: string;
  readonly name: string;
  readonly timestamp: number;
}

export interface VSCodeWorkspaceClosedPayload {
  readonly workspaceId: VSCodeWorkspaceId;
  readonly rootPath: string;
  readonly timestamp: number;
}

export interface VSCodeWorkspaceErrorPayload {
  readonly rootPath: string;
  readonly reason: string;
  readonly timestamp: number;
}

export interface VSCodeFileEventPayload {
  readonly workspaceId: VSCodeWorkspaceId;
  readonly path: string;
  readonly kind: VSCodeEntryKind;
  readonly timestamp: number;
}

export interface VSCodeFileRenamedPayload {
  readonly workspaceId: VSCodeWorkspaceId;
  readonly from: string;
  readonly to: string;
  readonly kind: VSCodeEntryKind;
  readonly timestamp: number;
}

export interface VSCodeFileDeletedPayload {
  readonly workspaceId: VSCodeWorkspaceId;
  readonly path: string;
  readonly kind: VSCodeEntryKind;
  readonly timestamp: number;
}

export interface VSCodeWatcherStartedPayload {
  readonly workspaceId: VSCodeWorkspaceId;
  readonly rootPath: string;
  readonly timestamp: number;
}

export interface VSCodeWatcherStoppedPayload {
  readonly workspaceId: VSCodeWorkspaceId;
  readonly reason: string;
  readonly timestamp: number;
}

export interface VSCodeWorkspaceFileChangedPayload {
  readonly workspaceId: VSCodeWorkspaceId;
  readonly path: string;
  readonly changeType: VSCodeChangeType;
  readonly entryKind: VSCodeEntryKind;
  readonly timestamp: number;
}

export const VSCodeWorkspaceOpened =
  define<VSCodeWorkspaceOpenedPayload>('vscode.workspace-opened');
export const VSCodeWorkspaceClosed =
  define<VSCodeWorkspaceClosedPayload>('vscode.workspace-closed');
export const VSCodeWorkspaceError = define<VSCodeWorkspaceErrorPayload>('vscode.workspace-error');
export const VSCodeFileRead = define<VSCodeFileEventPayload>('vscode.file-read');
export const VSCodeFileWritten = define<VSCodeFileEventPayload>('vscode.file-written');
export const VSCodeFileCreated = define<VSCodeFileEventPayload>('vscode.file-created');
export const VSCodeFileRenamed = define<VSCodeFileRenamedPayload>('vscode.file-renamed');
export const VSCodeFileDeleted = define<VSCodeFileDeletedPayload>('vscode.file-deleted');
export const VSCodeWatcherStarted = define<VSCodeWatcherStartedPayload>('vscode.watcher-started');
export const VSCodeWatcherStopped = define<VSCodeWatcherStoppedPayload>('vscode.watcher-stopped');
export const VSCodeWorkspaceFileChanged = define<VSCodeWorkspaceFileChangedPayload>(
  'vscode.workspace-file-changed',
);

/** All VS Code integration event payloads, for consumers that need a union. */
export type VSCodeEventPayloads =
  | VSCodeWorkspaceOpenedPayload
  | VSCodeWorkspaceClosedPayload
  | VSCodeWorkspaceErrorPayload
  | VSCodeFileEventPayload
  | VSCodeFileRenamedPayload
  | VSCodeFileDeletedPayload
  | VSCodeWatcherStartedPayload
  | VSCodeWatcherStoppedPayload
  | VSCodeWorkspaceFileChangedPayload;

function define<T>(type: string): EventDefinition<T> {
  return { type, version: 1 };
}

/** Re-exported for the Studio API / Coordinator link that maps these to missions. */
export type { VSCodeWorkspaceStatus };
