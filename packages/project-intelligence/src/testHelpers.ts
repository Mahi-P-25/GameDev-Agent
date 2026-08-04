import type { Envelope, EventBusContract, EventDefinition } from '@gamedev-agent/events';
import type { FSImplementation } from '@gamedev-agent/tool-runtime';

/** A small project tree, rooted at `/demo`, used across Project Intelligence tests. */
export const SAMPLE_PROJECT: Record<string, string> = {
  '/demo/package.json': '{"name": "demo", "dependencies": {"three": "^0.160.0"}}',
  '/demo/src/index.ts': 'import { Scene } from "three";',
  '/demo/src/scenes/GameScene.ts': 'export const scene = new Scene();',
  '/demo/assets/textures/tiles.png': '\u0000\u0000\u0000',
  '/demo/tsconfig.json': '{"compilerOptions": {"strict": true}}',
  '/demo/README.md': '# Demo',
};

/** Resolve with the first envelope of `definition` published on `bus`. */
export function waitFor<T>(
  bus: EventBusContract,
  definition: EventDefinition<T>,
): Promise<Envelope<T>> {
  return new Promise((resolve) => {
    bus.once(definition, (envelope) => resolve(envelope));
  });
}

/** Build an FS seeded from a `path -> content` map, with real directory listing. */
export function memoryFS(seed: Record<string, string>): FSImplementation {
  const files = new Map<string, string>();
  for (const [path, content] of Object.entries(seed)) {
    files.set(normalize(path), content);
  }
  return {
    async readFile(path: string): Promise<string> {
      const content = files.get(normalize(path));
      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return content;
    },
    async writeFile(path: string, content: string): Promise<void> {
      files.set(normalize(path), content);
    },
    async createFile(path: string, content?: string): Promise<void> {
      files.set(normalize(path), content ?? '');
    },
    async deleteFile(path: string): Promise<void> {
      files.delete(normalize(path));
    },
    async renameFile(from: string, to: string): Promise<void> {
      const content = files.get(normalize(from));
      if (content === undefined) throw new Error(`ENOENT: ${from}`);
      files.delete(normalize(from));
      files.set(normalize(to), content);
    },
    async listFiles(
      dirPath: string,
    ): Promise<ReadonlyArray<{ name: string; path: string; isDirectory: boolean }>> {
      const dir = normalize(dirPath);
      const prefix = dir === '/' ? '/' : dir === '' ? '' : `${dir}/`;
      const children = new Map<string, { isDirectory: boolean; full: string }>();
      for (const key of files.keys()) {
        if (key === dir) continue;
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        if (rest.length === 0) continue;
        const [segment] = rest.split('/');
        if (segment === undefined) continue;
        if (!children.has(segment)) {
          children.set(segment, {
            isDirectory: rest.length > segment.length,
            full: prefix + segment,
          });
        }
      }
      return [...children.entries()].map(([name, info]) => ({
        name,
        path: info.full,
        isDirectory: info.isDirectory,
      }));
    },
    async searchFiles(): Promise<ReadonlyArray<string>> {
      return [];
    },
    async searchText(): Promise<ReadonlyArray<{ path: string; line: number; match: string }>> {
      return [];
    },
  };
}

function normalize(path: string): string {
  const cleaned = path.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  return cleaned.startsWith('./') ? cleaned.slice(2) : cleaned;
}
