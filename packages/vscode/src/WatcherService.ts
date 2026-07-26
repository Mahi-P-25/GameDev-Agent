import { type FSWatcher, watch } from 'node:fs';
import { resolve } from 'node:path';
import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { Disposable, Timestamp } from '@gamedev-agent/shared';
import { VSCodeError } from './VSCodeErrors';
import {
  VSCodeWatcherStarted,
  VSCodeWatcherStopped,
  VSCodeWorkspaceFileChanged,
} from './VSCodeEvents';
import { toPosix, toWorkspaceRelative } from './VSCodePaths';
import type {
  VSCodeChangeType,
  VSCodeFileChange,
  VSCodeWatcher,
  VSCodeWorkspaceId,
} from './VSCodeTypes';
import type { WorkspaceService } from './WorkspaceService';

/**
 * Watches the open VS Code workspace for filesystem changes and publishes them
 * as typed events on the shared bus.
 *
 * The watcher is **explicitly started and stopped** by callers (it is never
 * auto-started). Each observed change is mapped to a {@link VSCodeFileChange}
 * and emitted as `vscode.workspace-file-changed` so the Studio API, Coordinator,
 * Memory, and UI observe workspace activity without the integration leaking
 * `node:fs` specifics. A debounce coalesces bursts (e.g. an editor writing
 * several files at once) into a single delivery window.
 *
 * The returned {@link VSCodeWatcher} is the only handle; disposing it stops
 * watching and emits `vscode.watcher-stopped`.
 */
export interface WatcherServiceOptions {
  readonly eventBus: EventBusContract;
  readonly workspace: WorkspaceService;
  readonly logger?: Logger;
  /** Debounce window in ms applied to change events. Default 50ms. */
  readonly debounceMs?: number;
}

export class WatcherService implements Disposable {
  private readonly bus: EventBusContract;
  private readonly workspace: WorkspaceService;
  private readonly logger: Logger;
  private readonly debounceMs: number;

  private watcher: FSWatcher | null = null;
  private active = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly pending = new Map<string, VSCodeFileChange>();
  private disposed = false;

  constructor(options: WatcherServiceOptions) {
    this.bus = options.eventBus;
    this.workspace = options.workspace;
    this.logger = options.logger ?? new RootLogger('nova.vscode', [new ConsoleLogSink()]);
    this.debounceMs = options.debounceMs ?? 50;
  }

  /**
   * Start watching the open workspace. Emits `vscode.watcher-started`. Throws
   * {@link VSCodeError} if already watching or no workspace is open.
   */
  start(): VSCodeWatcher {
    if (this.disposed) {
      throw new VSCodeError('watcher service is disposed');
    }
    if (this.active) {
      throw new VSCodeError('watcher is already active');
    }
    const root = this.workspace.getRoot();
    const workspaceId = this.workspace.getWorkspaceId();
    this.active = true;
    try {
      this.watcher = watch(root, { recursive: true }, (_event, filename) => {
        if (filename === null) {
          return;
        }
        this.observe(root, workspaceId, resolve(root, String(filename)));
      });
    } catch (error) {
      this.active = false;
      throw new VSCodeError(
        `failed to start watcher: ${error instanceof Error ? error.message : String(error)}`,
        {
          cause: error,
        },
      );
    }

    this.watcher.on('error', (error: Error) => {
      this.logger.error('vscode.watcher-error', { error: error.message });
      this.active = false;
    });

    this.logger.info('vscode.watcher-started', { rootPath: root });
    void this.bus.publish(VSCodeWatcherStarted, {
      workspaceId,
      rootPath: root,
      timestamp: this.now(),
    });

    const self = this;
    return {
      get active(): boolean {
        return self.active;
      },
      dispose(): void {
        self.stop('watcher disposed');
      },
    };
  }

  /** Whether the watcher is currently active. */
  isActive(): boolean {
    return this.active;
  }

  /** Stop watching and emit `vscode.watcher-stopped`. No-op safe. */
  stop(reason = 'requested'): void {
    if (!this.active) {
      return;
    }
    const workspaceId: VSCodeWorkspaceId | null = this.workspace.isOpen()
      ? this.workspace.getWorkspaceId()
      : null;
    this.flush(workspaceId ?? undefined);
    if (this.watcher !== null) {
      void this.watcher.close();
      this.watcher = null;
    }
    this.active = false;
    this.logger.info('vscode.watcher-stopped', { reason });
    void this.bus.publish(VSCodeWatcherStopped, {
      workspaceId: workspaceId ?? ('' as VSCodeWorkspaceId),
      reason,
      timestamp: this.now(),
    });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.stop('service disposed');
  }

  // --- internals -------------------------------------------------------------

  private observe(root: string, workspaceId: VSCodeWorkspaceId, filename: string): void {
    const rel = toWorkspaceRelative(root, filename);
    const posix = toPosix(rel);
    const changeType = this.classify(filename);
    const previous = this.pending.get(posix);
    const change: VSCodeFileChange = {
      path: posix,
      type: previous === undefined ? changeType : this.mergeType(previous.type, changeType),
      entryKind: 'file',
      timestamp: this.now(),
    };
    this.pending.set(posix, change);
    this.scheduleFlush(workspaceId);
  }

  private classify(_filename: string): VSCodeChangeType {
    return 'modified';
  }

  private mergeType(a: VSCodeChangeType, b: VSCodeChangeType): VSCodeChangeType {
    if (a === b) {
      return a;
    }
    return 'modified';
  }

  private scheduleFlush(workspaceId: VSCodeWorkspaceId): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.flush(workspaceId), this.debounceMs);
  }

  private flush(workspaceId?: VSCodeWorkspaceId): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pending.size === 0) {
      return;
    }
    const id: VSCodeWorkspaceId =
      workspaceId ??
      (this.workspace.isOpen() ? this.workspace.getWorkspaceId() : ('' as VSCodeWorkspaceId));
    for (const change of this.pending.values()) {
      void this.bus.publish(VSCodeWorkspaceFileChanged, {
        workspaceId: id,
        path: change.path,
        changeType: change.type,
        entryKind: change.entryKind,
        timestamp: change.timestamp,
      });
    }
    this.pending.clear();
  }

  private now(): Timestamp {
    return Date.now() as Timestamp;
  }
}
