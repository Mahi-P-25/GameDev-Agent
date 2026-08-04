import { FILESYSTEM_TOOL_ID } from '@gamedev-agent/tool-runtime';
import type { ToolManager } from '@gamedev-agent/tool-runtime';
import type { FileIndex } from './types';

/** Paths we are willing to read content for. Everything else is indexed with
 *  empty content so the file tree/asset inventory stay truthful without reading
 *  binaries we cannot represent as text. */
const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.mdx',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.html',
  '.htm',
  '.xml',
  '.svg',
  '.glsl',
  '.frag',
  '.vert',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.env',
  '.txt',
  '.sh',
  '.bat',
  '.lock',
  '.gitignore',
  '.gitattributes',
]);

interface FsEntry {
  readonly name: string;
  readonly path: string;
  readonly isDirectory: boolean;
}

interface ReadResult {
  readonly path: string;
  readonly content: string;
}

/**
 * Walks a project's filesystem through the **Filesystem tool seam** — never by
 * reading the OS directly. `files.list` discovers the tree; `files.read`
 * captures the content of text files. This keeps the indexer independent of the
 * concrete filesystem implementation: an `InMemoryFSImplementation` in the
 * browser, a real FS on a Node host, both through the same {@link ToolManager}.
 */
export class ProjectIndexer {
  constructor(private readonly tools: ToolManager) {}

  /** Index `rootPath` into a relative-path → content map. */
  async index(rootPath: string): Promise<FileIndex> {
    const index: FileIndex = {};
    const visited = new Set<string>();
    await this.walk(rootPath, rootPath, index, visited);
    return index;
  }

  private async walk(
    rootPath: string,
    dirPath: string,
    index: FileIndex,
    visited: Set<string>,
  ): Promise<void> {
    const dirKey = normalize(dirPath);
    if (visited.has(dirKey)) {
      return;
    }
    visited.add(dirKey);

    const entries = await this.list(dirPath);
    for (const entry of entries) {
      const fullPath = entry.path;
      if (entry.isDirectory) {
        await this.walk(rootPath, fullPath, index, visited);
        continue;
      }

      const relative = toRelative(rootPath, fullPath);
      if (relative.length === 0) {
        continue;
      }

      const ext = extensionOf(relative);
      const content = TEXT_EXTENSIONS.has(ext) ? await this.read(fullPath) : '';
      index[relative] = content;
    }
  }

  private async list(dirPath: string): Promise<readonly FsEntry[]> {
    const result = await this.tools.invoke({
      toolId: FILESYSTEM_TOOL_ID,
      action: 'files.list',
      input: { dirPath },
      actor: { kind: 'project-intelligence' },
      correlationId: null,
    });
    if (!result.ok) {
      return [];
    }
    const entries = asEntryList(result.output);
    return entries ?? [];
  }

  private async read(path: string): Promise<string> {
    const result = await this.tools.invoke({
      toolId: FILESYSTEM_TOOL_ID,
      action: 'files.read',
      input: { path },
      actor: { kind: 'project-intelligence' },
      correlationId: null,
    });
    if (!result.ok) {
      return '';
    }
    const read = asReadResult(result.output);
    return read?.content ?? '';
  }
}

/** Normalize separators, collapse slashes, and drop a leading `./`. */
function normalize(path: string): string {
  const cleaned = path.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  return cleaned.startsWith('./') ? cleaned.slice(2) : cleaned;
}

/** Derive the project-relative path for a full filesystem path. */
function toRelative(root: string, full: string): string {
  const rootNorm = normalize(root);
  const fullNorm = normalize(full);
  if (fullNorm === rootNorm) {
    return '';
  }
  const prefix = rootNorm === '' ? '' : `${rootNorm}/`;
  if (fullNorm.startsWith(prefix)) {
    return fullNorm.slice(prefix.length);
  }
  return fullNorm;
}

function extensionOf(path: string): string {
  const name = path.split('/').pop() ?? path;
  const dot = name.lastIndexOf('.');
  if (dot <= 0) {
    return `.${name.toLowerCase()}`;
  }
  return name.slice(dot).toLowerCase();
}

/** Runtime shape guard for a `files.list` output array. */
function asEntryList(output: unknown): readonly FsEntry[] | null {
  if (!Array.isArray(output)) {
    return null;
  }
  const entries: FsEntry[] = [];
  for (const item of output) {
    if (typeof item !== 'object' || item === null) {
      return null;
    }
    const record = item as Record<string, unknown>;
    if (
      typeof record.name !== 'string' ||
      typeof record.path !== 'string' ||
      typeof record.isDirectory !== 'boolean'
    ) {
      return null;
    }
    entries.push({ name: record.name, path: record.path, isDirectory: record.isDirectory });
  }
  return entries;
}

/** Runtime shape guard for a `files.read` output object. */
function asReadResult(output: unknown): ReadResult | null {
  if (typeof output !== 'object' || output === null) {
    return null;
  }
  const record = output as Record<string, unknown>;
  if (typeof record.path !== 'string' || typeof record.content !== 'string') {
    return null;
  }
  return { path: record.path, content: record.content };
}
