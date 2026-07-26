import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { Disposable, Timestamp } from '@gamedev-agent/shared';
import {
  VSCodeAlreadyExistsError,
  VSCodeEntryKindError,
  VSCodeRejectedError,
  mapFsError,
} from './VSCodeErrors';
import {
  VSCodeFileCreated,
  VSCodeFileDeleted,
  VSCodeFileRead,
  VSCodeFileRenamed,
  VSCodeFileWritten,
} from './VSCodeEvents';
import { resolveWithinRoot, toPosix, toWorkspaceRelative } from './VSCodePaths';
import type {
  VSCodeEntryKind,
  VSCodeFileContent,
  VSCodeFileCreated as VSCodeFileCreatedResultType,
  VSCodeFileEntry,
} from './VSCodeTypes';
import type { WorkspaceService } from './WorkspaceService';

/**
 * The explicit, auditable file surface over the open VS Code workspace.
 *
 * Every method performs exactly one filesystem operation and is fully explicit:
 * there is no "auto-save", no implicit write-back, no background mutation. Reads
 * return content; writes create/replace files; `create` refuses to clobber; and
 * `rename`/`delete` require an explicit call. Each successful mutation emits a
 * typed event on the shared bus so the rest of Nova observes the change without
 * the integration reaching into subsystems directly.
 *
 * All `path` arguments are workspace-relative POSIX strings; the
 * {@link WorkspaceService} supplies the root and {@link resolveWithinRoot}
 * enforces the traversal guard. Failures are translated into the
 * {@link VSCodeError} hierarchy at the edge via {@link mapFsError}.
 */
export interface FileServiceOptions {
  readonly eventBus: EventBusContract;
  readonly workspace: WorkspaceService;
  readonly logger?: Logger;
}

export class FileService implements Disposable {
  private readonly bus: EventBusContract;
  private readonly workspace: WorkspaceService;
  private readonly logger: Logger;

  constructor(options: FileServiceOptions) {
    this.bus = options.eventBus;
    this.workspace = options.workspace;
    this.logger = options.logger ?? new RootLogger('nova.vscode', [new ConsoleLogSink()]);
  }

  /**
   * List the immediate children of a directory (defaults to the workspace root).
   * Returns workspace-relative entries with kind, size, and modified time.
   */
  async list(dirPath = ''): Promise<ReadonlyArray<VSCodeFileEntry>> {
    const root = this.workspace.getRoot();
    const absolute = resolveWithinRoot(root, dirPath);
    let handle: Awaited<ReturnType<typeof stat>>;
    try {
      handle = await stat(absolute);
    } catch (error) {
      throw mapFsError(error, absolute);
    }
    if (!handle.isDirectory()) {
      throw new VSCodeEntryKindError(toPosix(dirPath), 'directory', 'file');
    }
    const names = await readdir(absolute);
    const entries: Array<VSCodeFileEntry> = [];
    for (const name of names) {
      let child: Awaited<ReturnType<typeof stat>>;
      try {
        child = await stat(join(absolute, name));
      } catch (error) {
        throw mapFsError(error, join(absolute, name));
      }
      const kind: VSCodeEntryKind = child.isDirectory()
        ? 'directory'
        : child.isSymbolicLink()
          ? 'symlink'
          : 'file';
      entries.push({
        path: toWorkspaceRelative(root, join(absolute, name)),
        kind,
        size: child.size,
        modifiedAt: child.mtimeMs as Timestamp,
      });
    }
    return entries;
  }

  /** Read a file's full text content. Throws on a directory or missing path. */
  async read(filePath: string): Promise<VSCodeFileContent> {
    const root = this.workspace.getRoot();
    const absolute = resolveWithinRoot(root, filePath);
    let handle: Awaited<ReturnType<typeof stat>>;
    try {
      handle = await stat(absolute);
    } catch (error) {
      throw mapFsError(error, absolute);
    }
    if (handle.isDirectory()) {
      throw new VSCodeEntryKindError(toPosix(filePath), 'file', 'directory');
    }
    const content = await readFile(absolute, 'utf-8');
    const modifiedAt = handle.mtimeMs as Timestamp;
    this.logger.debug('vscode.file-read', { path: toPosix(filePath), size: content.length });
    await this.bus.publish(VSCodeFileRead, {
      workspaceId: this.workspace.getWorkspaceId(),
      path: toPosix(filePath),
      kind: 'file',
      timestamp: this.now(),
    });
    return {
      path: toPosix(filePath),
      content,
      size: content.length,
      modifiedAt,
      encoding: 'utf-8',
    };
  }

  /**
   * Write a file, creating parent directories as needed. When `force` is false
   * (default) an existing file is rejected with {@link VSCodeRejectedError} so a
   * caller cannot clobber data without explicitly opting in.
   */
  async write(filePath: string, content: string, options?: { force?: boolean }): Promise<void> {
    const root = this.workspace.getRoot();
    const absolute = resolveWithinRoot(root, filePath);
    const exists = await this.existsOnDisk(absolute);
    if (exists && !(options?.force ?? false)) {
      throw new VSCodeRejectedError(
        'file.write',
        `refusing to overwrite "${toPosix(filePath)}" without force`,
      );
    }
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, content, 'utf-8');
    this.logger.info('vscode.file-written', { path: toPosix(filePath), size: content.length });
    await this.bus.publish(VSCodeFileWritten, {
      workspaceId: this.workspace.getWorkspaceId(),
      path: toPosix(filePath),
      kind: 'file',
      timestamp: this.now(),
    });
  }

  /**
   * Create a new, empty file (or directory). Refuses to overwrite an existing
   * entry ({@link VSCodeAlreadyExistsError}). Emits `vscode.file-created`.
   */
  async create(
    filePath: string,
    options?: { kind?: VSCodeEntryKind; content?: string },
  ): Promise<VSCodeFileCreatedResultType> {
    const root = this.workspace.getRoot();
    const absolute = resolveWithinRoot(root, filePath);
    const kind = options?.kind ?? 'file';
    if (await this.existsOnDisk(absolute)) {
      throw new VSCodeAlreadyExistsError(toPosix(filePath));
    }
    await mkdir(dirname(absolute), { recursive: true });
    if (kind === 'directory') {
      await mkdir(absolute, { recursive: true });
    } else {
      await writeFile(absolute, options?.content ?? '', 'utf-8');
    }
    this.logger.info('vscode.file-created', { path: toPosix(filePath), kind });
    await this.bus.publish(VSCodeFileCreated, {
      workspaceId: this.workspace.getWorkspaceId(),
      path: toPosix(filePath),
      kind,
      timestamp: this.now(),
    });
    return { path: toPosix(filePath), kind };
  }

  /**
   * Rename (move) a file or directory. Refuses when the destination already
   * exists ({@link VSCodeAlreadyExistsError}) and emits `vscode.file-renamed`.
   */
  async rename(from: string, to: string): Promise<void> {
    const root = this.workspace.getRoot();
    const absoluteFrom = resolveWithinRoot(root, from);
    const absoluteTo = resolveWithinRoot(root, to);
    if (!(await this.existsOnDisk(absoluteFrom))) {
      throw mapFsError({ code: 'ENOENT' }, absoluteFrom);
    }
    if (await this.existsOnDisk(absoluteTo)) {
      throw new VSCodeAlreadyExistsError(toPosix(to));
    }
    await mkdir(dirname(absoluteTo), { recursive: true });
    await rename(absoluteFrom, absoluteTo);
    this.logger.info('vscode.file-renamed', { from: toPosix(from), to: toPosix(to) });
    await this.bus.publish(VSCodeFileRenamed, {
      workspaceId: this.workspace.getWorkspaceId(),
      from: toPosix(from),
      to: toPosix(to),
      kind: 'file',
      timestamp: this.now(),
    });
  }

  /** Delete a file or directory (recursively). Emits `vscode.file-deleted`. */
  async delete(filePath: string, options?: { recursive?: boolean }): Promise<void> {
    const root = this.workspace.getRoot();
    const absolute = resolveWithinRoot(root, filePath);
    if (!(await this.existsOnDisk(absolute))) {
      throw mapFsError({ code: 'ENOENT' }, absolute);
    }
    await rm(absolute, { recursive: options?.recursive ?? true, force: false });
    this.logger.info('vscode.file-deleted', { path: toPosix(filePath) });
    await this.bus.publish(VSCodeFileDeleted, {
      workspaceId: this.workspace.getWorkspaceId(),
      path: toPosix(filePath),
      kind: 'file',
      timestamp: this.now(),
    });
  }

  /** Copy a file within the workspace (uses the platform copy, no transform). */
  async copy(from: string, to: string): Promise<void> {
    const root = this.workspace.getRoot();
    const absoluteFrom = resolveWithinRoot(root, from);
    const absoluteTo = resolveWithinRoot(root, to);
    if (!(await this.existsOnDisk(absoluteFrom))) {
      throw mapFsError({ code: 'ENOENT' }, absoluteFrom);
    }
    if (await this.existsOnDisk(absoluteTo)) {
      throw new VSCodeAlreadyExistsError(toPosix(to));
    }
    await mkdir(dirname(absoluteTo), { recursive: true });
    await copyFile(absoluteFrom, absoluteTo);
    this.logger.info('vscode.file-copied', { from: toPosix(from), to: toPosix(to) });
  }

  dispose(): void {
    // No long-lived handles are held by the file service; the audit/lifecycle
    // belongs to the owning VSCodeClient. Kept for interface symmetry.
  }

  private async existsOnDisk(absolute: string): Promise<boolean> {
    try {
      await stat(absolute);
      return true;
    } catch {
      return false;
    }
  }

  private now(): Timestamp {
    return Date.now() as Timestamp;
  }
}
