import type { FileIndex, PackageManager, PackageManifest } from '../types';
import { normalizePath } from './paths';

/** Lockfile → package manager, in priority order. */
export const LOCKFILE_TO_MANAGER: ReadonlyArray<readonly [string, PackageManager]> = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
  ['bun.lockb', 'npm'],
  ['Cargo.lock', 'cargo'],
];

/** Detect the primary package manager from lockfiles + the root manifest. */
export function detectPackageManager(
  files: FileIndex,
  rootManifest: PackageManifest | undefined,
): PackageManager {
  const keys = Object.keys(files).map(normalizePath);
  for (const [lockfile, manager] of LOCKFILE_TO_MANAGER) {
    if (keys.includes(lockfile)) {
      return manager;
    }
  }
  if (rootManifest !== undefined) {
    const declared = rootManifest.packageManager;
    if (declared !== undefined) {
      const name = declared.split('@')[0];
      if (name === 'pnpm' || name === 'yarn' || name === 'npm') {
        return name;
      }
    }
    return 'npm';
  }
  if (keys.includes('Cargo.toml')) {
    return 'cargo';
  }
  return 'unknown';
}

/** Collect every package manager with evidence (lockfiles + manifests). */
export function detectPackageManagers(files: FileIndex, primary: PackageManager): string[] {
  const found = new Set<string>(primary === 'unknown' ? [] : [primary]);
  const keys = Object.keys(files).map(normalizePath);
  for (const [lockfile, manager] of LOCKFILE_TO_MANAGER) {
    if (keys.includes(lockfile)) {
      found.add(manager);
    }
  }
  if (keys.includes('package.json')) {
    found.add('npm');
  }
  if (keys.includes('Cargo.toml')) {
    found.add('cargo');
  }
  return [...found];
}

/** The lockfiles present in a file index. */
export function detectLockfiles(files: FileIndex): string[] {
  const keys = Object.keys(files).map(normalizePath);
  const lockfiles: string[] = [];
  for (const key of keys) {
    if (key === 'package-lock.json' || key === 'npm-shrinkwrap.json') {
      lockfiles.push(key);
    } else if (LOCKFILE_TO_MANAGER.some(([lockfile]) => lockfile === key)) {
      lockfiles.push(key);
    }
  }
  return lockfiles;
}
