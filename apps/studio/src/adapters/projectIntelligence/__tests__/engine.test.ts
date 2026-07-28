import { describe, it, expect } from 'vitest';
import { ProjectIntelligenceEngine } from '../engine';
import { MockWorkspaceScanner } from '../scanner';
import type { FileIndex } from '../types';

const MOCK_FILES: FileIndex = {
  '/src/App.tsx': "import React from 'react';\nimport { createContext } from 'react';\nconst ctx = createContext(null);",
  '/src/main.tsx': "import React from 'react'; import ReactDOM from 'react-dom';",
  '/src/utils/helpers.ts': 'export const add = (a: number, b: number) => a + b;',
  '/src/utils/helper.test.ts': "import { add } from './helpers';",
  '/src/styles/tailwind.css': '@tailwind base;',
  '/package.json': JSON.stringify({
    dependencies: { react: '^18.0.0' },
    devDependencies: { vite: '^5.0.0', tailwindcss: '^4.0.0' },
  }),
  '/tsconfig.json': '{}',
  '/vite.config.ts': 'export default {}',
  '/.gitignore': 'node_modules\ndist',
};

describe('ProjectIntelligenceEngine', () => {
  it('scans workspace and produces ProjectContext', async () => {
    const engine = new ProjectIntelligenceEngine(new MockWorkspaceScanner(MOCK_FILES));
    const ctx = await engine.scanWorkspace();

    expect(ctx.workspacePath).toBe('.');
    expect(ctx.technologies.length).toBeGreaterThan(0);
    expect(ctx.health.totalFiles).toBeGreaterThan(0);
    expect(ctx.summary.configFiles.length).toBeGreaterThan(0);
  });

  it('detects package managers', async () => {
    const engine = new ProjectIntelligenceEngine(new MockWorkspaceScanner(MOCK_FILES));
    const ctx = await engine.scanWorkspace();

    expect(ctx.summary.packageManagers).toContain('npm');
  });

  it('detects build systems', async () => {
    const engine = new ProjectIntelligenceEngine(new MockWorkspaceScanner(MOCK_FILES));
    const ctx = await engine.scanWorkspace();

    expect(ctx.summary.buildSystems).toContain('vite');
  });

  it('returns cached object reference for same path', async () => {
    const engine = new ProjectIntelligenceEngine(new MockWorkspaceScanner(MOCK_FILES));
    const ctx1 = await engine.scanWorkspace();
    const ctx2 = await engine.scanWorkspace();

    expect(ctx1).toBe(ctx2);
  });

  it('creates new context after cache invalidation', async () => {
    const engine = new ProjectIntelligenceEngine(new MockWorkspaceScanner(MOCK_FILES));
    const ctx1 = await engine.scanWorkspace();
    engine.invalidateCache();
    const ctx2 = await engine.scanWorkspace();

    expect(ctx1).not.toBe(ctx2);
  });

  it('scanWithData works without a scanner', async () => {
    const engine = new ProjectIntelligenceEngine();
    const ctx = await engine.scanWithData(MOCK_FILES);

    expect(ctx.technologies.length).toBeGreaterThan(0);
    expect(ctx.health.totalFiles).toBeGreaterThan(0);
  });

  it('detects architecture patterns', async () => {
    const files: FileIndex = {
      ...MOCK_FILES,
      '/src/studio/Provider.tsx': "import { createContext } from 'react';\nexport const Ctx = createContext(null);",
      '/src/pages/HomePage.tsx': "import { Page } from '../components/layout/Page';",
      '/src/pages/AboutPage.tsx': "import { Page } from '../components/layout/Page';",
      '/src/adapters/apiAdapter.ts': 'export interface ApiAdapter { fetch(): Promise<unknown>; }',
      '/src/services/apiClient.ts': 'export interface ApiClient { get(path: string): Promise<unknown>; }',
    };
    const engine = new ProjectIntelligenceEngine(new MockWorkspaceScanner(files));
    const ctx = await engine.scanWithData(files);

    expect(ctx.architecture.length).toBeGreaterThan(0);
    const patterns = ctx.architecture.map((a) => a.name);
    expect(patterns).toContain('React Context');
    expect(patterns).toContain('Adapter Pattern');
    expect(patterns).toContain('Service Layer');
  });

  it('generates scan timestamp in ISO format', async () => {
    const engine = new ProjectIntelligenceEngine(new MockWorkspaceScanner(MOCK_FILES));
    const ctx = await engine.scanWorkspace();

    expect(ctx.scanTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('handles empty workspace gracefully', async () => {
    const engine = new ProjectIntelligenceEngine(new MockWorkspaceScanner({}));
    const ctx = await engine.scanWorkspace();

    expect(ctx.technologies.length).toBe(0);
    expect(ctx.health.totalFiles).toBe(0);
    expect(ctx.health.score).toBeGreaterThanOrEqual(10);
  });
});
