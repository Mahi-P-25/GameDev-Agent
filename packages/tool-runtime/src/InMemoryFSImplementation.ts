import type { FSImplementation } from './FilesystemToolAdapter';

/**
 * A browser-safe, in-memory virtual filesystem implementation of {@link FSImplementation}.
 * Handles file reading, writing, creation, deletion, listing, and search.
 */
export class InMemoryFSImplementation implements FSImplementation {
  private readonly files = new Map<string, string>();
  private readonly directories = new Set<string>();

  constructor() {
    this.directories.add('.');
  }

  /** Normalize paths so Windows / POSIX slash variations match cleanly */
  private normalize(path: string): string {
    const trimmed = path.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
    return trimmed.startsWith('./') ? trimmed.slice(2) : trimmed;
  }

  async readFile(path: string): Promise<string> {
    const norm = this.normalize(path);
    const content = this.files.get(norm);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const norm = this.normalize(path);
    this.files.set(norm, content);

    // Track parent directories
    const parts = norm.split('/');
    let current = '';
    for (let i = 0; i < parts.length - 1; i++) {
      current = current ? `${current}/${parts[i]}` : parts[i]!;
      this.directories.add(current);
    }
  }

  async createFile(path: string, content?: string): Promise<void> {
    await this.writeFile(path, content ?? '');
  }

  async deleteFile(path: string, recursive?: boolean): Promise<void> {
    const norm = this.normalize(path);
    if (this.files.has(norm)) {
      this.files.delete(norm);
      return;
    }

    if (recursive) {
      const prefix = norm.endsWith('/') ? norm : `${norm}/`;
      for (const key of Array.from(this.files.keys())) {
        if (key.startsWith(prefix)) {
          this.files.delete(key);
        }
      }
      for (const dir of Array.from(this.directories.keys())) {
        if (dir === norm || dir.startsWith(prefix)) {
          this.directories.delete(dir);
        }
      }
    }
  }

  async renameFile(from: string, to: string): Promise<void> {
    const content = await this.readFile(from);
    await this.deleteFile(from);
    await this.writeFile(to, content);
  }

  async listFiles(
    dirPath: string,
  ): Promise<ReadonlyArray<{ name: string; path: string; isDirectory: boolean }>> {
    const normDir = this.normalize(dirPath);
    const prefix = normDir === '.' || normDir === '' ? '' : normDir.endsWith('/') ? normDir : `${normDir}/`;
    const entries = new Map<string, { name: string; path: string; isDirectory: boolean }>();

    for (const fileKey of this.files.keys()) {
      if (prefix === '' || fileKey.startsWith(prefix)) {
        const relative = prefix === '' ? fileKey : fileKey.slice(prefix.length);
        const parts = relative.split('/');
        const name = parts[0]!;
        if (parts.length > 1) {
          const dirPathFull = prefix + name;
          entries.set(name, { name, path: dirPathFull, isDirectory: true });
        } else {
          entries.set(name, { name, path: fileKey, isDirectory: false });
        }
      }
    }

    for (const dirKey of this.directories) {
      if (dirKey !== '' && dirKey !== '.' && (prefix === '' || dirKey.startsWith(prefix))) {
        const relative = prefix === '' ? dirKey : dirKey.slice(prefix.length);
        if (relative.length > 0) {
          const name = relative.split('/')[0]!;
          const dirPathFull = prefix + name;
          entries.set(name, { name, path: dirPathFull, isDirectory: true });
        }
      }
    }

    return Array.from(entries.values());
  }

  async searchFiles(pattern: string): Promise<ReadonlyArray<string>> {
    const lower = pattern.toLowerCase();
    const results: string[] = [];
    for (const fileKey of this.files.keys()) {
      if (fileKey.toLowerCase().includes(lower)) {
        results.push(fileKey);
      }
    }
    return results;
  }

  async searchText(
    query: string,
    pathPattern?: string,
  ): Promise<ReadonlyArray<{ path: string; line: number; match: string }>> {
    const results: Array<{ path: string; line: number; match: string }> = [];
    const normPattern = pathPattern ? this.normalize(pathPattern).toLowerCase() : null;

    for (const [fileKey, content] of this.files.entries()) {
      if (normPattern && !fileKey.toLowerCase().includes(normPattern)) {
        continue;
      }
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.includes(query)) {
          results.push({ path: fileKey, line: i + 1, match: line });
        }
      }
    }

    return results;
  }
}
