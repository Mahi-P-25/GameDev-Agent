import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { Disposable, Timestamp, UUID } from '@gamedev-agent/shared';
import { FileService } from './FileService';
import { SearchService } from './SearchService';
import type { CoordinatorLink } from './VSCodeTypes';
import type {
  VSCodeActor,
  VSCodeAuditOperation,
  VSCodeAuditRecord,
  VSCodeClientOptions,
  VSCodeFileContent,
  VSCodeFileCreated,
  VSCodeFileEntry,
  VSCodeFileMatch,
  VSCodeSearchFilesOptions,
  VSCodeSearchTextOptions,
  VSCodeTextMatch,
  VSCodeWatcher,
  VSCodeWorkspaceInfo,
} from './VSCodeTypes';
import { WatcherService } from './WatcherService';
import { WorkspaceService } from './WorkspaceService';

/**
 * The **VSCodeClient** — the single, stable surface the rest of Nova uses to
 * talk to a local VS Code workspace.
 *
 * It is the integration's façade: it owns the lifecycle of the four services
 * (Workspace, File, Search, Watcher), exposes the ten capabilities required by
 * the sprint, and **audits every operation**. Each public method names an
 * explicit {@link VSCodeActor} and an optional `correlationId` so the action can
 * be traced to a Mission on the Coordinator / Event Bus. The client never
 * performs work on its own initiative — every effect is the direct result of an
 * explicit call.
 *
 * Integration scope is deliberately narrow: the client talks to the rest of Nova
 * only through the injected `EventBusContract` and the optional
 * `CoordinatorLink`. It imports no subsystem packages directly.
 */
export class VSCodeClient implements Disposable {
  readonly bus: EventBusContract;
  private readonly logger: Logger;
  private readonly coordinator: CoordinatorLink | undefined;

  private readonly workspace: WorkspaceService;
  private readonly files: FileService;
  private readonly search: SearchService;
  private readonly watcher: WatcherService;

  private readonly audit: Array<VSCodeAuditRecord> = [];
  private seq = 0;
  private disposed = false;

  constructor(options: VSCodeClientOptions) {
    this.bus = options.eventBus;
    this.logger = options.logger ?? new RootLogger('nova.vscode', [new ConsoleLogSink()]);
    this.coordinator = options.coordinator;

    this.workspace = new WorkspaceService({
      eventBus: this.bus,
      logger: this.logger,
      ...(options.idGenerator !== undefined ? { idGenerator: options.idGenerator } : {}),
    });
    this.files = new FileService({
      eventBus: this.bus,
      workspace: this.workspace,
      logger: this.logger,
    });
    this.search = new SearchService({ workspace: this.workspace });
    this.watcher = new WatcherService({
      eventBus: this.bus,
      workspace: this.workspace,
      logger: this.logger,
    });
  }

  // --- workspace ------------------------------------------------------------

  /** Open a VS Code workspace at `rootPath`. Audited as `workspace.open`. */
  async openWorkspace(
    rootPath: string,
    actor: VSCodeActor,
    correlationId: UUID | null = null,
  ): Promise<VSCodeWorkspaceInfo> {
    return this.run('workspace.open', actor, correlationId, async () => {
      return await this.workspace.open(rootPath);
    });
  }

  /** Close the open workspace. Audited as `workspace.close`. */
  async closeWorkspace(actor: VSCodeActor, correlationId: UUID | null = null): Promise<void> {
    await this.run('workspace.close', actor, correlationId, async () => {
      await this.workspace.close();
    });
  }

  /** Snapshot of the current workspace. */
  getWorkspaceInfo(): VSCodeWorkspaceInfo {
    const info = this.workspace.info();
    return { ...info, watching: this.watcher.isActive() };
  }

  // --- files -----------------------------------------------------------------

  /** List the immediate children of a directory. Audited as `file.list`. */
  async listFiles(
    actor: VSCodeActor,
    dirPath = '',
    correlationId: UUID | null = null,
  ): Promise<ReadonlyArray<VSCodeFileEntry>> {
    return this.run(
      'file.list',
      actor,
      correlationId,
      async () => {
        return await this.files.list(dirPath);
      },
      dirPath,
    );
  }

  /** Read a file. Audited as `file.read`. */
  async readFile(
    actor: VSCodeActor,
    filePath: string,
    correlationId: UUID | null = null,
  ): Promise<VSCodeFileContent> {
    return this.run(
      'file.read',
      actor,
      correlationId,
      async () => {
        return await this.files.read(filePath);
      },
      filePath,
    );
  }

  /** Write a file. Audited as `file.write`. */
  async writeFile(
    actor: VSCodeActor,
    filePath: string,
    content: string,
    correlationId: UUID | null = null,
    options?: { force?: boolean },
  ): Promise<void> {
    await this.run(
      'file.write',
      actor,
      correlationId,
      async () => {
        await this.files.write(filePath, content, options);
      },
      filePath,
    );
  }

  /** Create a file/directory. Audited as `file.create`. */
  async createFile(
    actor: VSCodeActor,
    filePath: string,
    correlationId: UUID | null = null,
    options?: { kind?: 'file' | 'directory'; content?: string },
  ): Promise<VSCodeFileCreated> {
    return this.run(
      'file.create',
      actor,
      correlationId,
      async () => {
        return await this.files.create(filePath, options);
      },
      filePath,
    );
  }

  /** Rename/move a file or directory. Audited as `file.rename`. */
  async renameFile(
    actor: VSCodeActor,
    from: string,
    to: string,
    correlationId: UUID | null = null,
  ): Promise<void> {
    await this.run(
      'file.rename',
      actor,
      correlationId,
      async () => {
        await this.files.rename(from, to);
      },
      from,
    );
  }

  /** Delete a file or directory. Audited as `file.delete`. */
  async deleteFile(
    actor: VSCodeActor,
    filePath: string,
    correlationId: UUID | null = null,
    options?: { recursive?: boolean },
  ): Promise<void> {
    await this.run(
      'file.delete',
      actor,
      correlationId,
      async () => {
        await this.files.delete(filePath, options);
      },
      filePath,
    );
  }

  // --- search ----------------------------------------------------------------

  /** Search files by name/glob. Audited as `search.files`. */
  async searchFiles(
    actor: VSCodeActor,
    options?: VSCodeSearchFilesOptions,
    correlationId: UUID | null = null,
  ): Promise<ReadonlyArray<VSCodeFileMatch>> {
    return this.run('search.files', actor, correlationId, async () => {
      return await this.search.searchFiles(options);
    });
  }

  /** Search file contents for text. Audited as `search.text`. */
  async searchText(
    actor: VSCodeActor,
    query: string,
    options?: VSCodeSearchTextOptions,
    correlationId: UUID | null = null,
  ): Promise<ReadonlyArray<VSCodeTextMatch>> {
    return this.run('search.text', actor, correlationId, async () => {
      return await this.search.searchText(query, options);
    });
  }

  // --- watch -----------------------------------------------------------------

  /** Start watching the workspace. Audited as `watch.start`. */
  startWatch(actor: VSCodeActor, correlationId: UUID | null = null): VSCodeWatcher {
    const { record } = this.begin('watch.start', actor, correlationId);
    try {
      const handle = this.watcher.start();
      this.commit(record, true);
      return handle;
    } catch (error) {
      this.commit(record, false, error);
      throw error;
    }
  }

  /** Stop watching the workspace. Audited as `watch.stop`. */
  stopWatch(actor: VSCodeActor, correlationId: UUID | null = null, reason?: string): void {
    this.run('watch.stop', actor, correlationId, () => {
      this.watcher.stop(reason);
    });
  }

  // --- audit -----------------------------------------------------------------

  /** The full, immutable audit trail in emission order (oldest → newest). */
  auditTrail(): ReadonlyArray<VSCodeAuditRecord> {
    return this.audit;
  }

  /** The `limit` most recent audit records (oldest → newest). */
  recentAudit(limit = 50): ReadonlyArray<VSCodeAuditRecord> {
    return this.audit.slice(-limit);
  }

  /** Resolve the mission id for a correlation id, if the Coordinator link is wired. */
  resolveMission(correlationId: UUID): { missionId: string } | null {
    return this.coordinator?.resolveMission(correlationId) ?? null;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.watcher.dispose();
    this.search.dispose();
    this.files.dispose();
    this.workspace.dispose();
  }

  // --- internals -------------------------------------------------------------

  private begin(
    operation: VSCodeAuditOperation,
    actor: VSCodeActor,
    correlationId: UUID | null,
    path?: string,
  ): { record: Omit<VSCodeAuditRecord, 'ok' | 'error'>; seq: number } {
    const seq = this.seq;
    this.seq += 1;
    const record: Omit<VSCodeAuditRecord, 'ok' | 'error'> = {
      seq,
      kind: operation,
      operation,
      actor,
      correlationId,
      timestamp: Date.now() as Timestamp,
      ...(path !== undefined ? { path } : {}),
    };
    return { record, seq };
  }

  private commit(
    partial: Omit<VSCodeAuditRecord, 'ok' | 'error'>,
    ok: boolean,
    error?: unknown,
  ): void {
    const entry: VSCodeAuditRecord = {
      ...partial,
      ok,
      ...(ok ? {} : { error: String(error) }),
    };
    this.audit.push(entry);
  }

  private async run<T>(
    operation: VSCodeAuditOperation,
    actor: VSCodeActor,
    correlationId: UUID | null,
    action: () => Promise<T> | T,
    path?: string,
  ): Promise<T> {
    const { record } = this.begin(operation, actor, correlationId, path);
    try {
      const result = await action();
      this.commit(record, true);
      return result;
    } catch (error) {
      this.commit(record, false, error);
      throw error;
    }
  }
}
