import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import type { Disposable, Timestamp, UUID } from '@gamedev-agent/shared';

/**
 * Domain model and contracts for the Nova VS Code integration.
 *
 * The VS Code integration is the **reference plugin** for Nova. It is the first
 * real, non-stub integration and is deliberately built the way every future
 * plugin (Git, Terminal, Browser, …) should be built: it owns a narrow, audited
 * surface over an external environment, talks to Nova only through the Studio
 * API, Event Bus, and Coordinator, and never performs work on its own initiative.
 *
 * This module defines the public, stable shapes the rest of the package
 * consumes. It contains no logic — only types.
 */

/** Branded VS Code workspace identifier. Plain string at runtime, distinct at the type level. */
export type VSCodeWorkspaceId = UUID & { readonly __brand: 'VSCodeWorkspaceId' };

/** Coerce a string into a {@link VSCodeWorkspaceId}. Purely a type-level assertion. */
export function asVSCodeWorkspaceId(value: string): VSCodeWorkspaceId {
  return value as VSCodeWorkspaceId;
}

/**
 * Lifecycle status of a connected VS Code workspace.
 *
 * ```
 * closed → open → closed | error
 * ```
 *
 * A workspace cannot be `open`ed twice, nor `close`d unless it is `open`. The
 * {@link WorkspaceService} enforces these transitions and emits a corresponding
 * event for every change.
 */
export type VSCodeWorkspaceStatus = 'closed' | 'open' | 'error';

/** The kind of a file-system entry within a workspace. */
export type VSCodeEntryKind = 'file' | 'directory' | 'symlink';

/** A single entry returned by a workspace listing. Paths are workspace-relative. */
export interface VSCodeFileEntry {
  /** Workspace-relative POSIX-style path (always uses `/` separators). */
  readonly path: string;
  /** The entry kind: file, directory, or symlink. */
  readonly kind: VSCodeEntryKind;
  /** Size in bytes (0 for directories and unavailable stat). */
  readonly size: number;
  /** Last-modified time (ms since epoch). */
  readonly modifiedAt: Timestamp;
}

/** A file read back from the workspace. */
export interface VSCodeFileContent {
  /** Workspace-relative POSIX-style path. */
  readonly path: string;
  /** Raw file contents. */
  readonly content: string;
  /** Byte length of the content. */
  readonly size: number;
  /** Last-modified time (ms since epoch). */
  readonly modifiedAt: Timestamp;
  /** Encoding used when reading (always `utf-8` for this integration). */
  readonly encoding: 'utf-8';
}

/** Result of creating a file (explicit, audited operation). */
export interface VSCodeFileCreated {
  readonly path: string;
  readonly kind: VSCodeEntryKind;
}

/** Metadata describing the connected VS Code workspace. */
export interface VSCodeWorkspaceInfo {
  readonly id: VSCodeWorkspaceId;
  readonly name: string;
  /** Absolute path on disk of the opened workspace root. */
  readonly rootPath: string;
  readonly status: VSCodeWorkspaceStatus;
  readonly openedAt: Timestamp | null;
  /** Whether a file watcher is currently active for this workspace. */
  readonly watching: boolean;
}

/**
 * One line in the immutable audit trail.
 *
 * Every file operation the integration performs is explicit and auditable: a
 * single method call produces exactly one audit record with a stable
 * discriminator (`kind`), the actor that requested it, and a correlation id so
 * the action can be traced back to a Mission on the Event Bus / Coordinator.
 */
export interface VSCodeAuditRecord {
  /** Monotonic, per-client sequence number. */
  readonly seq: number;
  /** Stable discriminator, e.g. `file.write`, `search.text`. */
  readonly kind: string;
  /** The operation that was performed. */
  readonly operation: VSCodeAuditOperation;
  /** Workspace-relative path the operation targeted, when applicable. */
  readonly path?: string;
  /** The actor on whose behalf the operation ran (user / role / mission). */
  readonly actor: VSCodeActor;
  /** Correlation id linking the operation to a Mission / run on the bus. */
  readonly correlationId: UUID | null;
  /** Whether the operation succeeded. */
  readonly ok: boolean;
  /** Present when `ok` is false. */
  readonly error?: string;
  /** Event time (ms since epoch). */
  readonly timestamp: Timestamp;
}

/** The set of operations the integration can perform (used for audit + events). */
export type VSCodeAuditOperation =
  | 'workspace.open'
  | 'workspace.close'
  | 'file.list'
  | 'file.read'
  | 'file.write'
  | 'file.create'
  | 'file.rename'
  | 'file.delete'
  | 'search.files'
  | 'search.text'
  | 'watch.start'
  | 'watch.stop';

/**
 * The actor on whose behalf an operation is performed. The integration never
 * decides to act on its own: every operation names an explicit actor so the
 * audit trail is unambiguous.
 */
export interface VSCodeActor {
  /** Human or system label, e.g. `director`, `role:gameplay-engineer`. */
  readonly kind: string;
  /** Optional stable id (user id, role id, mission id). */
  readonly id?: string;
}

/**
 * Options for constructing the {@link VSCodeClient}. The client depends only on
 * abstractions (`EventBusContract`, `Logger`) and an optional Coordinator hook,
 * never on concrete subsystems — so it slots into the kernel via DI and is
 * independently testable with doubles.
 */
export interface VSCodeClientOptions {
  /** Shared Nova Event Bus. Required; the client emits workspace + file events here. */
  readonly eventBus: EventBusContract;
  /** Namespaced logger. A console-backed root logger is the default. */
  readonly logger?: Logger;
  /** Id generator for workspace ids; injected so tests are deterministic. */
  readonly idGenerator?: () => string;
  /**
   * Optional Coordinator integration. When supplied, file operations are linked
   * to a Mission via `correlationId` so the operation is observable in the
   * Coordinator's event stream. The client only *publishes* through the bus and
   * only *reads* the Coordinator's token via DI — it never calls it directly.
   */
  readonly coordinator?: CoordinatorLink;
}

/**
 * The narrow seam this integration uses to participate in the Coordinator's
 * mission stream. We depend on the interface, not the concrete
 * {@link CoordinatorManager}, so the package can be unit-tested and so a future
 * Coordinator revision can be swapped behind the same contract.
 */
export interface CoordinatorLink {
  /** Resolve the mission id for a correlation id, if known. */
  resolveMission(correlationId: UUID): { missionId: string } | null;
}

/** A single match produced by a text search. */
export interface VSCodeTextMatch {
  /** Workspace-relative POSIX-style path of the matching file. */
  readonly path: string;
  /** 1-based line number of the match. */
  readonly line: number;
  /** 1-based column of the match start. */
  readonly column: number;
  /** The full matched line (trimmed of trailing newline). */
  readonly lineText: string;
}

/** A single match produced by a file-name search. */
export interface VSCodeFileMatch {
  /** Workspace-relative POSIX-style path of the matching entry. */
  readonly path: string;
  /** The entry kind. */
  readonly kind: VSCodeEntryKind;
}

/** Options controlling a file-name search. */
export interface VSCodeSearchFilesOptions {
  /** Glob pattern (e.g. `**\/*.ts`). Defaults to match everything. */
  readonly pattern?: string;
  /** Directories to skip (workspace-relative). Defaults to common ignores. */
  readonly ignore?: ReadonlyArray<string>;
  /** Maximum number of results to return. */
  readonly limit?: number;
  /** Whether to include directories in results. */
  readonly includeDirectories?: boolean;
}

/** Options controlling a text search. */
export interface VSCodeSearchTextOptions {
  /** Case-insensitive match. Defaults to `false`. */
  readonly caseSensitive?: boolean;
  /** File glob to constrain the search (e.g. `**\/*.ts`). */
  readonly include?: string;
  /** File glob to exclude (e.g. `**\/node_modules\/**`). */
  readonly exclude?: string;
  /** Maximum number of matches to return. */
  readonly limit?: number;
}

/** A live watcher subscription handle. Disposing stops watching. */
export interface VSCodeWatcher extends Disposable {
  /** Whether the watcher is currently active. */
  readonly active: boolean;
  /** Stop watching and release the underlying file-system handle. */
  dispose(): void;
}

/**
 * One filesystem change emitted by the {@link WatcherService}. These are the raw
 * observations; the {@link VSCodeClient} publishes them as typed events on the
 * shared bus so the rest of Nova observes workspace changes without the
 * integration leaking its internals.
 */
export interface VSCodeFileChange {
  /** Workspace-relative POSIX-style path of the changed entry. */
  readonly path: string;
  /** The kind of change observed. */
  readonly type: VSCodeChangeType;
  /** The entry kind at the time of observation (best effort). */
  readonly entryKind: VSCodeEntryKind;
  /** Event time (ms since epoch). */
  readonly timestamp: Timestamp;
}

/** The kind of filesystem change observed by the watcher. */
export type VSCodeChangeType = 'created' | 'modified' | 'deleted' | 'renamed';

/** Re-exported so consumers do not need a second import for the dispose contract. */
export type { Disposable };
