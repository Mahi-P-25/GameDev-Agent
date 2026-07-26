import { isAbsolute, relative, resolve } from 'node:path';
import { VSCodePathTraversalError } from './VSCodeErrors';

/**
 * Path helpers for the VS Code integration.
 *
 * All paths exchanged with callers are **workspace-relative POSIX-style**
 * strings (`src/index.ts`, `assets/hero.png`). On disk they are resolved
 * against the workspace root. A single, tested resolution function enforces the
 * path-traversal guard so no service can accidentally reach outside the
 * workspace root.
 */

/** Normalize a workspace-relative path into POSIX separators (collapsing `.`/`..`). */
export function toPosix(path: string): string {
  const normalized = path.split(/[\\/]/).filter((segment) => segment.length > 0 && segment !== '.');
  const out: Array<string> = [];
  for (const segment of normalized) {
    if (segment === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') {
        out.pop();
      } else {
        out.push('..');
      }
    } else {
      out.push(segment);
    }
  }
  return out.join('/');
}

/**
 * Resolve a workspace-relative path against the root, returning an absolute
 * path. Throws {@link VSCodePathTraversalError} when the resolved path would
 * escape the root (no `..` beyond the boundary, no absolute input). The returned
 * path is guaranteed to be `root`-prefixed.
 */
export function resolveWithinRoot(root: string, workspaceRelativePath: string): string {
  const posix = toPosix(workspaceRelativePath);
  if (posix.startsWith('..')) {
    throw new VSCodePathTraversalError(posix, root);
  }
  if (isAbsolute(posix)) {
    throw new VSCodePathTraversalError(posix, root);
  }
  const candidate = posix === '' ? root : resolve(root, posix);
  const back = relative(root, candidate);
  if (back !== '' && (back === '..' || back.startsWith(`..${'/'}`))) {
    throw new VSCodePathTraversalError(posix, root);
  }
  return candidate;
}

/** Convert an absolute path back into a workspace-relative POSIX path. */
export function toWorkspaceRelative(root: string, absolutePath: string): string {
  const rel = relative(root, absolutePath).split(/[\\/]/).join('/');
  return rel === '' ? '' : toPosix(rel);
}
