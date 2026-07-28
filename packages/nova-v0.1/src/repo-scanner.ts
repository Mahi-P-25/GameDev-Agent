import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RepoInfo } from './types';

const PACKAGE_MANAGER_FILES: Record<string, string> = {
  'package-lock.json': 'npm',
  'yarn.lock': 'yarn',
  'pnpm-lock.yaml': 'pnpm',
  'bun.lockb': 'bun',
};

const PACKAGE_MANAGER_FALLBACK = 'npm';

const FRAMEWORK_PACKAGES: Record<string, string> = {
  three: 'three.js',
  '@babylonjs/core': 'babylon.js',
  phaser: 'phaser',
  playcanvas: 'playcanvas',
  'p5.js': 'p5.js',
  aframe: 'aframe',
};

const BUILD_SYSTEM_FILES: Record<string, string> = {
  'vite.config.ts': 'vite',
  'vite.config.js': 'vite',
  'vite.config.mjs': 'vite',
  'webpack.config.js': 'webpack',
  'webpack.config.ts': 'webpack',
  'rollup.config.js': 'rollup',
  'rollup.config.ts': 'rollup',
  'tsup.config.ts': 'tsup',
  'tsup.config.js': 'tsup',
  'esbuild.config.js': 'esbuild',
  'esbuild.config.mjs': 'esbuild',
};

function detectFramework(deps: Record<string, string>): string | null {
  const all = { ...deps };
  for (const [pkg, fw] of Object.entries(FRAMEWORK_PACKAGES)) {
    if (pkg in all) return fw;
  }

  if ('react' in all || 'react-dom' in all) return 'react';
  if ('vue' in all) return 'vue';
  if ('svelte' in all) return 'svelte';
  if ('@angular/core' in all) return 'angular';

  for (const name of Object.keys(all)) {
    if (name.includes('three')) return 'three.js';
  }

  return null;
}

function detectLanguage(rootDir: string, deps: Record<string, string>): string | null {
  if (existsSync(join(rootDir, 'tsconfig.json'))) return 'typescript';
  if (existsSync(join(rootDir, 'jsconfig.json'))) return 'javascript';
  if ('typescript' in deps) return 'typescript';
  if (existsSync(join(rootDir, 'src'))) {
    const files = [join(rootDir, 'src', 'main.ts'), join(rootDir, 'src', 'index.ts'), join(rootDir, 'src', 'main.tsx'), join(rootDir, 'src', 'index.tsx')];
    if (files.some((f) => existsSync(f))) return 'typescript';
  }
  return null;
}

function detectBuildSystem(rootDir: string): string | null {
  for (const [file, system] of Object.entries(BUILD_SYSTEM_FILES)) {
    if (existsSync(join(rootDir, file))) return system;
  }
  if (existsSync(join(rootDir, 'package.json'))) {
    try {
      const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
      const scripts = (pkg.scripts as Record<string, string>) ?? {};
      const allScripts = Object.values(scripts).join(' ');
      if (allScripts.includes('vite')) return 'vite';
      if (allScripts.includes('webpack')) return 'webpack';
      if (allScripts.includes('rollup')) return 'rollup';
      if (allScripts.includes('tsup')) return 'tsup';
      if (allScripts.includes('esbuild')) return 'esbuild';
    } catch {
      // ignore parse errors
    }
  }
  return null;
}

function detectPackageManager(rootDir: string): string | null {
  for (const [file, pm] of Object.entries(PACKAGE_MANAGER_FILES)) {
    if (existsSync(join(rootDir, file))) return pm;
  }
  return null;
}

function detectGitBranch(rootDir: string): string | null {
  const headFile = join(rootDir, '.git', 'HEAD');
  if (!existsSync(headFile)) return null;
  try {
    const content = readFileSync(headFile, 'utf-8').trim();
    const refPrefix = 'ref: refs/heads/';
    if (content.startsWith(refPrefix)) {
      return content.slice(refPrefix.length);
    }
    return content;
  } catch {
    return null;
  }
}

function parsePackageJson(rootDir: string): Record<string, string> {
  const pkgPath = join(rootDir, 'package.json');
  if (!existsSync(pkgPath)) return {};
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}), ...(pkg.peerDependencies ?? {}) } as Record<string, string>;
  } catch {
    return {};
  }
}

export function scanRepo(rootDir: string): RepoInfo {
  const deps = parsePackageJson(rootDir);

  return {
    packageManager: detectPackageManager(rootDir) ?? PACKAGE_MANAGER_FALLBACK,
    framework: detectFramework(deps),
    language: detectLanguage(rootDir, deps),
    buildSystem: detectBuildSystem(rootDir),
    isGitRepo: existsSync(join(rootDir, '.git')),
    gitBranch: detectGitBranch(rootDir),
  };
}
