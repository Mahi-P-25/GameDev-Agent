import { describe, expect, it } from 'vitest';
import type { FileIndex } from '../types';
import { DependencyAnalyzer, analyzeDependencyIndex } from './DependencyAnalyzer';

const MONOREPO: FileIndex = {
  'package.json': JSON.stringify({
    name: 'monorepo-root',
    version: '1.0.0',
    private: true,
    workspaces: ['packages/*'],
    dependencies: { lodash: '^4' },
    devDependencies: { typescript: '^5' },
  }),
  'pnpm-workspace.yaml': 'packages:\n  - packages/*\n  - shared/*\n',
  'pnpm-lock.yaml': 'lockfileVersion: 9.0',
  'packages/ui/package.json': JSON.stringify({
    name: '@demo/ui',
    version: '0.1.0',
    dependencies: { react: '^18' },
    peerDependencies: { react: '^18' },
  }),
  'packages/game/package.json': JSON.stringify({ name: '@demo/game', version: '0.1.0' }),
  'shared/util/package.json': JSON.stringify({ name: '@demo/util', version: '0.1.0' }),
};

describe('DependencyAnalyzer', () => {
  it('detects every manifest, root-first, and the root manifest', () => {
    const index = new DependencyAnalyzer().analyze(MONOREPO);

    expect(index.manifests).toHaveLength(4);
    expect(index.manifests[0]?.path).toBe('package.json');
    expect(index.rootManifest?.name).toBe('monorepo-root');
    expect(index.rootManifest?.workspaces).toEqual(['packages/*']);
  });

  it('aggregates dependency, devDependency, and peerDependency sets', () => {
    const index = analyzeDependencyIndex(MONOREPO);

    expect(index.dependencies.lodash).toBe('^4');
    expect(index.dependencies.react).toBe('^18');
    expect(index.devDependencies.typescript).toBe('^5');
    expect(index.peerDependencies.react).toBe('^18');
  });

  it('detects workspace packages from workspaces globs and pnpm-workspace.yaml', () => {
    const index = analyzeDependencyIndex(MONOREPO);

    const names = index.workspacePackages.map((p) => p.name);
    expect(names).toContain('@demo/ui');
    expect(names).toContain('@demo/game');
    expect(names).toContain('@demo/util');

    const ui = index.workspacePackages.find((p) => p.name === '@demo/ui');
    expect(ui?.path).toBe('packages/ui');

    const root = index.workspacePackages.find((p) => p.root);
    expect(root?.name).toBe('monorepo-root');
    expect(root?.path).toBe('.');
  });

  it('detects the package manager and lockfiles', () => {
    const index = analyzeDependencyIndex(MONOREPO);
    expect(index.packageManager).toBe('pnpm');
    expect(index.packageManagers).toContain('pnpm');
    expect(index.lockfiles).toContain('pnpm-lock.yaml');
  });

  it('handles a project with no package.json', () => {
    const index = analyzeDependencyIndex({ 'src/main.py': 'print("hi")' });
    expect(index.manifests).toEqual([]);
    expect(index.rootManifest).toBeUndefined();
    expect(index.workspacePackages).toEqual([]);
    expect(index.packageManager).toBeUndefined();
  });
});
