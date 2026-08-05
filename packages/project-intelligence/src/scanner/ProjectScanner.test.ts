import { describe, expect, it } from 'vitest';
import type { FileIndex } from '../types';
import { ProjectScanner, scanProject } from './ProjectScanner';

const VITE_PROJECT: FileIndex = {
  'package.json': JSON.stringify({
    name: 'demo-app',
    version: '1.2.0',
    description: 'A demo app',
    license: 'MIT',
    packageManager: 'pnpm@9.12.0',
    scripts: { dev: 'vite', build: 'tsup', test: 'vitest' },
    dependencies: { react: '^18' },
    devDependencies: { vite: '^5', typescript: '^5' },
  }),
  'pnpm-lock.yaml': "lockfileVersion: '9.0'",
  'vite.config.ts': 'export default {};',
  'tsconfig.json': '{}',
  'src/main.tsx': 'import React from "react";',
  'index.html': '<div id="root"></div>',
  '.gitignore': 'node_modules\ndist',
  '.env': 'VITE_API_URL=https://example.com\nVITE_KEY=secret',
};

const PLAIN_TSCONFIG: FileIndex = {
  'tsconfig.json': '{}',
  'src/index.ts': 'export const a = 1;',
};

describe('ProjectScanner', () => {
  it('detects the vite/react/typescript/pnpm stack for a web project', () => {
    const scan = new ProjectScanner('/repo').scan(VITE_PROJECT);

    expect(scan.rootDirectory).toBe('/repo');
    expect(scan.packageManager).toBe('pnpm');
    expect(scan.packageManagers).toContain('pnpm');
    expect(scan.framework).toBe('React');
    expect(scan.language).toBe('TypeScript');
    expect(scan.buildTool).toBe('vite');
    expect(scan.buildTools).toContain('vite');
  });

  it('extracts scripts, git, environment, and entry files', () => {
    const scan = scanProject('/repo', VITE_PROJECT);

    expect(scan.scripts.map((s) => s.name)).toEqual(['build', 'dev', 'test']);
    expect(scan.gitRepository.detected).toBe(true);
    expect(scan.gitRepository.evidence).toContain('.gitignore');

    expect(scan.environment.detected).toBe(true);
    expect(scan.environment.files).toContain('.env');
    expect(scan.environment.variables).toContain('VITE_API_URL');
    expect(scan.environment.variables).toContain('VITE_KEY');

    expect(scan.entryFiles).toContain('index.html');
    expect(scan.entryFiles).toContain('src/main.tsx');
  });

  it('falls back to the manifest package manager when no lockfile exists', () => {
    const noLockfile: FileIndex = Object.fromEntries(
      Object.entries(VITE_PROJECT).filter(([key]) => key !== 'pnpm-lock.yaml'),
    );
    const scan = scanProject('/repo', noLockfile);
    expect(scan.packageManager).toBe('pnpm');
  });

  it('reports unknown package manager and build tool for bare tsconfig projects', () => {
    const scan = scanProject('/repo', PLAIN_TSCONFIG);
    expect(scan.packageManager).toBe('unknown');
    expect(scan.buildTool).toBe('unknown');
    expect(scan.language).toBe('TypeScript');
    expect(scan.scripts).toEqual([]);
    expect(scan.gitRepository.detected).toBe(false);
    expect(scan.environment.detected).toBe(false);
  });

  it('detects a git repository from a .git directory marker', () => {
    const scan = scanProject('/repo', {
      '.git/config': '[core] repositoryformatversion = 0',
      'src/index.ts': 'export const a = 1;',
    });
    expect(scan.gitRepository.detected).toBe(true);
    expect(scan.gitRepository.root).toBe('.');
  });
});
