import { findPackageManifests } from '../shared/packageJson';
import {
  detectLockfiles,
  detectPackageManager,
  detectPackageManagers,
} from '../shared/packageManager';
import { normalizePath } from '../shared/paths';
import type { DependencyIndex, FileIndex, PackageManifest, WorkspacePackage } from '../types';

const WORKSPACE_YAML = 'pnpm-workspace.yaml';

/**
 * Dependency Analyzer.
 *
 * Reads the manifest-level dependency picture of a project: every `package.json`
 * (root + workspace members), the dependency/devDependency/peerDependency and
 * optionalDependency sets, lockfiles, and the workspace packages declared via
 * `package.json` `workspaces` or `pnpm-workspace.yaml`.
 */
export class DependencyAnalyzer {
  /** Analyze a file index into a {@link DependencyIndex}. */
  analyze(files: FileIndex): DependencyIndex {
    const manifests = findPackageManifests(files);
    const rootManifest = manifests.find((manifest) => manifest.path === 'package.json');

    const packageManager = detectPackageManager(files, rootManifest);

    const workspaceGlobs = workspaceGlobsFor(rootManifest, files);
    const workspacePackages = resolveWorkspacePackages(manifests, rootManifest, workspaceGlobs);

    return {
      manifests,
      ...(rootManifest !== undefined ? { rootManifest } : {}),
      ...dependencySets(manifests),
      workspacePackages,
      packageManagers: detectPackageManagers(files, packageManager),
      ...(packageManager !== 'unknown' ? { packageManager } : {}),
      lockfiles: detectLockfiles(files),
    };
  }
}

/** Pure-function form of {@link DependencyAnalyzer}. */
export function analyzeDependencyIndex(files: FileIndex): DependencyIndex {
  return new DependencyAnalyzer().analyze(files);
}

function dependencySets(
  manifests: readonly PackageManifest[],
): Pick<
  DependencyIndex,
  'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies'
> {
  const sets = {
    dependencies: {},
    devDependencies: {},
    peerDependencies: {},
    optionalDependencies: {},
  } as Record<
    'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies',
    Record<string, string>
  >;

  // Manifests are sorted root-first by `findPackageManifests`; merging in that
  // order keeps the root's picture authoritative while still surfacing every
  // workspace member's dependencies.
  for (const manifest of manifests) {
    mergeInto(sets, manifest);
  }
  return sets;
}

function mergeInto(
  target: Record<
    'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies',
    Record<string, string>
  >,
  manifest: PackageManifest,
): void {
  target.dependencies = { ...target.dependencies, ...manifest.dependencies };
  target.devDependencies = { ...target.devDependencies, ...manifest.devDependencies };
  target.peerDependencies = { ...target.peerDependencies, ...manifest.peerDependencies };
  target.optionalDependencies = {
    ...target.optionalDependencies,
    ...manifest.optionalDependencies,
  };
}

function workspaceGlobsFor(rootManifest: PackageManifest | undefined, files: FileIndex): string[] {
  const globs = new Set<string>(rootManifest?.workspaces ?? []);
  const yamlPath = Object.keys(files).find((path) => normalizePath(path) === WORKSPACE_YAML);
  if (yamlPath !== undefined) {
    for (const glob of parsePnpmWorkspaceYaml(files[yamlPath] ?? '')) {
      globs.add(glob);
    }
  }
  return [...globs];
}

function resolveWorkspacePackages(
  manifests: readonly PackageManifest[],
  rootManifest: PackageManifest | undefined,
  workspaceGlobs: readonly string[],
): WorkspacePackage[] {
  const packages: WorkspacePackage[] = [];
  const seen = new Set<string>();

  for (const manifest of manifests) {
    const isRoot = manifest.path === 'package.json';
    if (isRoot) {
      continue;
    }
    const dir = manifest.path.slice(0, manifest.path.lastIndexOf('/'));
    const matched = workspaceGlobs.some((glob) => matchesWorkspaceGlob(glob, manifest.path));
    if (!matched) {
      continue;
    }
    if (seen.has(dir)) {
      continue;
    }
    seen.add(dir);
    packages.push({
      name: manifest.name ?? dir.split('/').pop() ?? dir,
      path: dir,
      root: false,
    });
  }

  if (rootManifest !== undefined && packages.length > 0) {
    packages.unshift({ name: rootManifest.name ?? '.', path: '.', root: true });
  }

  return packages.sort((a, b) => a.path.localeCompare(b.path));
}

/** Minimal `packages:` list reader for pnpm-workspace.yaml. */
function parsePnpmWorkspaceYaml(content: string): string[] {
  const globs: string[] = [];
  let inPackages = false;
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('packages:')) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      if (line.startsWith('- ')) {
        globs.push(line.slice(2).trim());
        continue;
      }
      if (line.length > 0 && !line.startsWith('#')) {
        inPackages = false;
      }
    }
  }
  return globs;
}

/** Convert a workspace glob like `packages/*` into a matcher over manifest paths. */
function matchesWorkspaceGlob(glob: string, manifestPath: string): boolean {
  const regexSource = glob
    .split('/')
    .map((segment) => {
      if (segment === '**') return '.*';
      if (segment.includes('*')) {
        return segment.split('*').map(escapeRegExp).join('[^/]*');
      }
      return escapeRegExp(segment);
    })
    .join('/');

  const re = new RegExp(`^${regexSource}/package\\.json$`);
  return re.test(normalizePath(manifestPath));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
