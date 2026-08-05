import type { FileIndex, PackageManifest, ScriptEntry } from '../types';
import { baseName, normalizePath } from './paths';

/**
 * package.json parsing shared by the {@link import('./scanner/ProjectScanner')}
 * and the {@link import('./dependency/DependencyAnalyzer') DependencyAnalyzer}.
 * The parser is deliberately lenient: a malformed manifest is skipped rather
 * than failing the whole scan.
 */

/** Parse every `package.json` in the file index, sorted by depth (root first). */
export function findPackageManifests(files: FileIndex): PackageManifest[] {
  const manifests: PackageManifest[] = [];
  for (const [path, content] of Object.entries(files)) {
    if (baseName(path) !== 'package.json') {
      continue;
    }
    const parsed = parsePackageManifest(path, content);
    if (parsed !== null) {
      manifests.push(parsed);
    }
  }
  return manifests.sort((a, b) => a.path.split('/').length - b.path.split('/').length);
}

/** Parse a single `package.json` content string, or `null` when malformed. */
export function parsePackageManifest(path: string, content: string): PackageManifest | null {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return null;
  }
  if (typeof json !== 'object' || json === null) {
    return null;
  }
  const record = json as Record<string, unknown>;

  const engines = stringRecord(record.engines);

  const manifest: PackageManifest = {
    path: normalizePath(path),
    scripts: entryScripts(record.scripts),
    dependencies: stringRecord(record.dependencies),
    devDependencies: stringRecord(record.devDependencies),
    peerDependencies: stringRecord(record.peerDependencies),
    optionalDependencies: stringRecord(record.optionalDependencies),
    workspaces: workspaceGlobs(record.workspaces),
    ...(typeof record.name === 'string' ? { name: record.name } : {}),
    ...(typeof record.version === 'string' ? { version: record.version } : {}),
    ...(typeof record.description === 'string' ? { description: record.description } : {}),
    ...(typeof record.license === 'string' ? { license: record.license } : {}),
    ...(typeof record.packageManager === 'string' ? { packageManager: record.packageManager } : {}),
    ...(typeof record.main === 'string' ? { main: record.main } : {}),
    ...(typeof record.module === 'string' ? { module: record.module } : {}),
    ...(typeof record.types === 'string' ? { types: record.types } : {}),
    ...(Object.keys(engines).length > 0 ? { engines } : {}),
  };

  return manifest;
}

/** Extract `{ "name": "command" }` entries into a sorted, typed list. */
export function entryScripts(scripts: unknown): ScriptEntry[] {
  if (typeof scripts !== 'object' || scripts === null) {
    return [];
  }
  const entries: ScriptEntry[] = [];
  for (const [name, command] of Object.entries(scripts as Record<string, unknown>)) {
    if (typeof command === 'string') {
      entries.push({ name, command });
    }
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

/** Normalize `workspaces` (array or `{ packages: [...] }`) into globs. */
function workspaceGlobs(workspaces: unknown): string[] {
  if (Array.isArray(workspaces)) {
    return workspaces.filter((w): w is string => typeof w === 'string');
  }
  if (typeof workspaces === 'object' && workspaces !== null) {
    const packages = (workspaces as Record<string, unknown>).packages;
    if (Array.isArray(packages)) {
      return packages.filter((w): w is string => typeof w === 'string');
    }
  }
  return [];
}

function stringRecord(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string') {
      result[key] = entry;
    }
  }
  return result;
}
