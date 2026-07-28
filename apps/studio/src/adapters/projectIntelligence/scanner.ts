import type { FileIndex } from './types';

export interface WorkspaceScanner {
  readonly source: 'vite-glob' | 'mock';
  scan(): Promise<FileIndex>;
}

export class ViteGlobScanner implements WorkspaceScanner {
  readonly source = 'vite-glob' as const;

  async scan(): Promise<FileIndex> {
    try {
      const merged: FileIndex = {};

      const loadGroup = async (loaders: Record<string, () => Promise<unknown>>): Promise<void> => {
        for (const [path, loader] of Object.entries(loaders)) {
          try {
            const content = await loader();
            if (typeof content === 'string' && !merged[path]) {
              merged[path] = content;
            }
          } catch {
            // skip individual file errors
          }
        }
      };

      await loadGroup(import.meta.glob('/src/**/*.{ts,tsx,js,jsx}', { query: '?raw', import: 'default' }));
      await loadGroup(import.meta.glob('/src/**/*.{css,json,md}', { query: '?raw', import: 'default' }));
      await loadGroup(import.meta.glob('/*.{ts,tsx,js,jsx,json,html,css,md}', { query: '?raw', import: 'default' }));
      await loadGroup(import.meta.glob('/**/*.{ts,tsx,js,jsx}', { query: '?raw', import: 'default' }));
      await loadGroup(import.meta.glob('/**/*.config.{ts,js,mjs}', { query: '?raw', import: 'default' }));

      return merged;
    } catch {
      return {};
    }
  }
}

export class MockWorkspaceScanner implements WorkspaceScanner {
  readonly source = 'mock' as const;
  private files: FileIndex;

  constructor(files?: FileIndex) {
    this.files = files ?? {};
  }

  async scan(): Promise<FileIndex> {
    return this.files;
  }
}
