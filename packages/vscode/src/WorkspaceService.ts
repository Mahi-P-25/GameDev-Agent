import { stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { Disposable, Timestamp } from '@gamedev-agent/shared';
import {
  VSCodeError,
  VSCodeWorkspaceClosedError,
  VSCodeWorkspaceOpenError,
  mapFsError,
} from './VSCodeErrors';
import { VSCodeWorkspaceClosed, VSCodeWorkspaceOpened } from './VSCodeEvents';
import {
  type VSCodeWorkspaceId,
  type VSCodeWorkspaceInfo,
  type VSCodeWorkspaceStatus,
  asVSCodeWorkspaceId,
} from './VSCodeTypes';

/**
 * Owns the lifecycle of the connected VS Code workspace: `open → close`.
 *
 * This is the only service that knows the absolute on-disk root. It validates
 * that the root exists and is a directory, derives a stable {@link
 * VSCodeWorkspaceId}, and emits `vscode.workspace-opened` / `vscode.workspace-closed`
 * over the shared Event Bus on every transition. Other services ask this one
 * for the root rather than holding it themselves, keeping a single source of
 * truth for "what is the current workspace".
 *
 * The service is `Disposable`: disposal forces a clean `close`. It depends only
 * on abstractions (`EventBusContract`, `Logger`) so it can be unit-tested with
 * doubles and so the integration never reaches into Nova internals.
 */
export interface WorkspaceServiceOptions {
  readonly eventBus: EventBusContract;
  readonly logger?: Logger;
  /** Id generator; injected so tests are deterministic. */
  readonly idGenerator?: () => string;
}

export class WorkspaceService implements Disposable {
  private readonly bus: EventBusContract;
  private readonly logger: Logger;
  private readonly idGenerator: () => string;

  private rootPath: string | null = null;
  private id: VSCodeWorkspaceId | null = null;
  private name: string | null = null;
  private status: VSCodeWorkspaceStatus = 'closed';
  private openedAt: Timestamp | null = null;
  private disposed = false;

  constructor(options: WorkspaceServiceOptions) {
    this.bus = options.eventBus;
    this.logger = options.logger ?? new RootLogger('nova.vscode', [new ConsoleLogSink()]);
    this.idGenerator = options.idGenerator ?? (() => asVSCodeWorkspaceId(crypto.randomUUID()));
  }

  /**
   * Open a VS Code workspace rooted at `rootPath`. Validates that the path
   * exists and is a directory, derives a stable id, and emits
   * `vscode.workspace-opened`. Throws {@link VSCodeWorkspaceOpenError} when the
   * path is invalid; throws {@link VSCodeError} when a workspace is already open
   * (callers must `close` first).
   */
  async open(rootPath: string): Promise<VSCodeWorkspaceInfo> {
    if (this.disposed) {
      throw new VSCodeError('workspace service is disposed');
    }
    if (this.status === 'open') {
      throw new VSCodeError(`a workspace is already open at "${this.rootPath}"`);
    }
    const resolved = isAbsolute(rootPath) ? rootPath : rootPath;
    try {
      const stats = await stat(resolved);
      if (!stats.isDirectory()) {
        throw new VSCodeWorkspaceOpenError(resolved, 'path is not a directory');
      }
    } catch (error) {
      const wrapped = mapFsError(error, resolved);
      if (wrapped instanceof VSCodeWorkspaceOpenError) {
        throw wrapped;
      }
      throw new VSCodeWorkspaceOpenError(resolved, wrapped.message, { cause: wrapped });
    }

    const id = asVSCodeWorkspaceId(this.idGenerator());
    const name = resolved.split(/[\\/]/).filter(Boolean).pop() ?? resolved;
    this.rootPath = resolved;
    this.id = id;
    this.name = name;
    this.status = 'open';
    this.openedAt = Date.now() as Timestamp;

    this.logger.info('vscode.workspace-opened', { id, rootPath: resolved, name });
    await this.bus.publish(VSCodeWorkspaceOpened, {
      workspaceId: id,
      rootPath: resolved,
      name,
      timestamp: this.now(),
    });

    return this.info();
  }

  /**
   * Close the currently open workspace. Emits `vscode.workspace-closed`. No-op
   * safe: closing an already-closed workspace still emits the event so observers
   * stay consistent.
   */
  async close(): Promise<void> {
    if (this.status !== 'open' || this.rootPath === null || this.id === null) {
      this.status = 'closed';
      return;
    }
    const rootPath = this.rootPath;
    const id = this.id;
    this.rootPath = null;
    this.id = null;
    this.name = null;
    this.status = 'closed';
    this.openedAt = null;
    this.logger.info('vscode.workspace-closed', { id, rootPath });
    await this.bus.publish(VSCodeWorkspaceClosed, {
      workspaceId: id,
      rootPath,
      timestamp: this.now(),
    });
  }

  /** The current absolute root path, or throws when no workspace is open. */
  getRoot(): string {
    if (this.rootPath === null) {
      throw new VSCodeWorkspaceClosedError();
    }
    return this.rootPath;
  }

  /** The current workspace id, or throws when no workspace is open. */
  getWorkspaceId(): VSCodeWorkspaceId {
    if (this.id === null) {
      throw new VSCodeWorkspaceClosedError();
    }
    return this.id;
  }

  /** Whether a workspace is currently open. */
  isOpen(): boolean {
    return this.status === 'open';
  }

  /** A snapshot of the current workspace metadata. */
  info(): VSCodeWorkspaceInfo {
    return {
      id: this.id ?? asVSCodeWorkspaceId(''),
      name: this.name ?? '',
      rootPath: this.rootPath ?? '',
      status: this.status,
      openedAt: this.openedAt,
      watching: false,
    };
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    void this.close().catch((error: unknown) => {
      this.logger.warn('vscode.workspace-close-failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  private now(): Timestamp {
    return Date.now() as Timestamp;
  }
}
