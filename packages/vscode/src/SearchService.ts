import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Disposable } from '@gamedev-agent/shared';
import { toPosix } from './VSCodePaths';
import type {
  VSCodeFileMatch,
  VSCodeSearchFilesOptions,
  VSCodeSearchTextOptions,
  VSCodeTextMatch,
} from './VSCodeTypes';
import type { WorkspaceService } from './WorkspaceService';

/**
 * Read-only search over the open VS Code workspace.
 *
 * Two capabilities:
 *  - **Search Files** — match entry paths against a glob (`**\/*.ts`).
 *  - **Search Text** — match file contents against a literal/pattern query,
 *    returning line/column-accurate hits.
 *
 * Search is strictly read-only: it never mutates the workspace and never reaches
 * into Nova subsystems. It depends only on the {@link WorkspaceService} for the
 * root and the traversal guard. Results are bounded by `limit` to keep large
 * workspaces safe and predictable.
 */

const DEFAULT_IGNORES = ['node_modules', '.git', 'dist', 'coverage', '.turbo', 'out'];

export class SearchService implements Disposable {
  private readonly workspace: WorkspaceService;

  constructor(options: { readonly workspace: WorkspaceService }) {
    this.workspace = options.workspace;
  }

  /** Find files/directories whose workspace-relative path matches `pattern`. */
  async searchFiles(options?: VSCodeSearchFilesOptions): Promise<ReadonlyArray<VSCodeFileMatch>> {
    const root = this.workspace.getRoot();
    const pattern = options?.pattern ?? '**/*';
    const matcher = compileGlob(pattern);
    const ignore = new Set([...DEFAULT_IGNORES, ...(options?.ignore ?? [])]);
    const limit = options?.limit ?? 1000;
    const includeDirectories = options?.includeDirectories ?? false;
    const results: Array<VSCodeFileMatch> = [];
    await this.walk(root, '', matcher, ignore, includeDirectories, limit, results);
    return results;
  }

  /**
   * Search file contents for `query`. Reads matching files (bounded by
   * `include`/`exclude`) and returns line/column-accurate matches.
   */
  async searchText(
    query: string,
    options?: VSCodeSearchTextOptions,
  ): Promise<ReadonlyArray<VSCodeTextMatch>> {
    const root = this.workspace.getRoot();
    const caseSensitive = options?.caseSensitive ?? false;
    const include = options?.include !== undefined ? compileGlob(options.include) : null;
    const exclude = options?.exclude !== undefined ? compileGlob(options.exclude) : null;
    const limit = options?.limit ?? 1000;
    const needle = caseSensitive ? query : query.toLowerCase();
    const matches: Array<VSCodeTextMatch> = [];

    const visit = async (absolute: string, rel: string): Promise<void> => {
      if (matches.length >= limit) {
        return;
      }
      let handle: Awaited<ReturnType<typeof stat>>;
      try {
        handle = await stat(absolute);
      } catch {
        return;
      }
      if (handle.isDirectory()) {
        const name = rel.split('/').pop() ?? '';
        if (DEFAULT_IGNORES.includes(name)) {
          return;
        }
        const children = await readdir(absolute);
        for (const child of children) {
          if (matches.length >= limit) {
            return;
          }
          await visit(join(absolute, child), rel === '' ? child : `${rel}/${child}`);
        }
        return;
      }
      if (handle.isSymbolicLink() || !handle.isFile()) {
        return;
      }
      const relPosix = toPosix(rel);
      if (exclude?.(relPosix)) {
        return;
      }
      if (include !== null && !include(relPosix)) {
        return;
      }
      const { readFile } = await import('node:fs/promises');
      const content = await readFile(absolute, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (matches.length >= limit) {
          break;
        }
        const lineText = lines[i] ?? '';
        const haystack = caseSensitive ? lineText : lineText.toLowerCase();
        const column = haystack.indexOf(needle);
        if (column >= 0) {
          matches.push({
            path: relPosix,
            line: i + 1,
            column: column + 1,
            lineText: lineText.replace(/\r$/, ''),
          });
        }
      }
    };

    await visit(root, '');
    return matches;
  }

  dispose(): void {
    // Read-only service; no long-lived handles to release.
  }

  private async walk(
    root: string,
    rel: string,
    matcher: (path: string) => boolean,
    ignore: Set<string>,
    includeDirectories: boolean,
    limit: number,
    out: Array<VSCodeFileMatch>,
  ): Promise<void> {
    let children: Array<string>;
    try {
      children = await readdir(join(root, rel));
    } catch {
      return;
    }
    for (const name of children) {
      if (out.length >= limit) {
        return;
      }
      const childRel = rel === '' ? name : `${rel}/${name}`;
      const childAbs = join(root, childRel);
      let handle: Awaited<ReturnType<typeof stat>>;
      try {
        handle = await stat(childAbs);
      } catch {
        continue;
      }
      const isDir = handle.isDirectory();
      if (ignore.has(name)) {
        continue;
      }
      const posixPath = toPosix(childRel);
      if (matcher(posixPath)) {
        if (isDir && !includeDirectories) {
          // skip directories unless explicitly requested
        } else {
          out.push({ path: posixPath, kind: isDir ? 'directory' : 'file' });
        }
      }
      if (isDir) {
        await this.walk(root, childRel, matcher, ignore, includeDirectories, limit, out);
      }
    }
  }
}

/**
 * Compile a glob pattern (`**`, `*`, `?`) into a matcher against POSIX
 * workspace-relative paths. Kept dependency-free and read-only; used only for
 * search, never for filesystem resolution (that path uses
 * {@link resolveWithinRoot}).
 */
export function compileGlob(pattern: string): (path: string) => boolean {
  // `**/` matches any number of leading path segments (including none);
  // a bare `**` matches anything. Handle these before per-segment escaping.
  const normalized = pattern.replace(/\*\*\//g, '§').replace(/\*\*/g, '‡');
  const escaped = normalized
    .split('/')
    .map((segment) => {
      let out = segment
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]');
      out = out.replace(/§/g, '(?:.*/)?').replace(/‡/g, '.*');
      return out;
    })
    .join('/');
  const regex = new RegExp(`^(?:${escaped})$`);
  return (path: string): boolean => regex.test(path);
}
