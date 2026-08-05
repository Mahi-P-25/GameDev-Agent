import { detectTechnologies } from '../analyzers/techDetector';
import { findPackageManifests } from '../shared/packageJson';
import { detectPackageManager, detectPackageManagers } from '../shared/packageManager';
import { normalizePath } from '../shared/paths';
import type {
  BuildTool,
  EnvironmentInfo,
  FileIndex,
  GitRepositoryInfo,
  PackageManifest,
  ScanResult,
} from '../types';

const CONFIG_TO_BUILD_TOOL: ReadonlyArray<readonly [string, BuildTool]> = [
  ['vite.config', 'vite'],
  ['webpack.config', 'webpack'],
  ['rollup.config', 'rollup'],
  ['tsup.config', 'tsup'],
  ['esbuild', 'esbuild'],
  ['turbo.json', 'turbo'],
  ['Cargo.toml', 'cargo'],
  ['CMakeLists.txt', 'cmake'],
  ['build.gradle', 'gradle'],
  ['pom.xml', 'maven'],
];

/**
 * Project Scanner.
 *
 * Answers the question "what kind of project is this?" — package manager,
 * framework, language, build tool, scripts, git repository, environment, and
 * root directory — from a single {@link FileIndex}, before any LLM call is
 * made. It reuses the shared tech detection so scanner output and the
 * `technologies` projection never disagree.
 */
export class ProjectScanner {
  constructor(private readonly rootDirectory: string) {}

  /** Scan the provided file index into a structured {@link ScanResult}. */
  scan(files: FileIndex): ScanResult {
    const technologies = detectTechnologies(files);
    const languages = technologies.filter((t) => t.category === 'language').map((t) => t.name);
    const frameworks = technologies.filter((t) => t.category === 'framework').map((t) => t.name);
    const engines = technologies.filter((t) => t.category === 'engine').map((t) => t.name);
    const toolNames = technologies.filter((t) => t.category === 'tool').map((t) => t.name);

    const manifests = findPackageManifests(files);
    const rootManifest = manifests.find((m) => m.path === 'package.json');

    const packageManager = detectPackageManager(files, rootManifest);

    return {
      rootDirectory: this.rootDirectory,
      packageManager,
      packageManagers: detectPackageManagers(files, packageManager),
      framework: frameworks[0] ?? engines[0] ?? 'unknown',
      frameworks,
      language: languages[0] ?? 'unknown',
      languages,
      buildTool: detectBuildTool(files, toolNames),
      buildTools: detectBuildTools(files),
      scripts: rootManifest?.scripts ?? [],
      gitRepository: detectGitRepository(files),
      environment: detectEnvironment(files),
      entryFiles: detectEntryFiles(files, rootManifest),
    };
  }
}

/** Pure-function form of {@link ProjectScanner} for one-shot scans. */
export function scanProject(rootDirectory: string, files: FileIndex): ScanResult {
  return new ProjectScanner(rootDirectory).scan(files);
}

function detectBuildTool(files: FileIndex, toolNames: readonly string[]): BuildTool {
  const keys = Object.keys(files).map(normalizePath);
  for (const [config, tool] of CONFIG_TO_BUILD_TOOL) {
    if (keys.some((key) => key.includes(config))) {
      return tool;
    }
  }
  if (toolNames.includes('Vite')) return 'vite';
  if (toolNames.includes('tsup')) return 'tsup';
  if (toolNames.includes('webpack')) return 'webpack';
  if (toolNames.includes('esbuild')) return 'esbuild';
  return 'unknown';
}

function detectBuildTools(files: FileIndex): string[] {
  const found: string[] = [];
  const keys = Object.keys(files).map(normalizePath);
  for (const [config, tool] of CONFIG_TO_BUILD_TOOL) {
    if (keys.some((key) => key.includes(config))) {
      found.push(tool);
    }
  }
  return found;
}

function detectGitRepository(files: FileIndex): GitRepositoryInfo {
  const markers: string[] = [];
  for (const path of Object.keys(files)) {
    const normalized = normalizePath(path);
    if (
      normalized === '.gitignore' ||
      normalized === '.gitattributes' ||
      normalized === '.git' ||
      normalized.startsWith('.git/') ||
      normalized.endsWith('/.git')
    ) {
      markers.push(normalized);
    }
  }
  if (markers.length === 0) {
    return { detected: false, evidence: [] };
  }
  const hasDotGitDir = markers.some((m) => m === '.git' || m.startsWith('.git/'));
  return {
    detected: true,
    ...(hasDotGitDir ? { root: '.' } : {}),
    evidence: markers.slice(0, 10),
  };
}

function detectEnvironment(files: FileIndex): EnvironmentInfo {
  const envFiles: string[] = [];
  const variables = new Set<string>();
  const variableRe = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/gm;

  for (const [path, content] of Object.entries(files)) {
    const name = path.split('/').pop() ?? path;
    if (name.startsWith('.env') || name.endsWith('.env')) {
      envFiles.push(path);
      variableRe.lastIndex = 0;
      for (let match = variableRe.exec(content); match !== null; match = variableRe.exec(content)) {
        const variable = match[1];
        if (variable !== undefined) {
          variables.add(variable);
        }
      }
    }
  }

  return envFiles.length > 0
    ? { detected: true, files: envFiles.sort(), variables: [...variables].sort() }
    : { detected: false, files: [], variables: [] };
}

function detectEntryFiles(files: FileIndex, rootManifest: PackageManifest | undefined): string[] {
  const entries: string[] = [];
  if (rootManifest !== undefined) {
    if (rootManifest.main !== undefined) entries.push(rootManifest.main);
    if (rootManifest.module !== undefined) entries.push(rootManifest.module);
    if (rootManifest.types !== undefined) entries.push(rootManifest.types);
  }

  const keys = new Set(Object.keys(files).map(normalizePath));
  const candidates = [
    'index.html',
    'src/main.ts',
    'src/main.tsx',
    'src/main.js',
    'src/index.ts',
    'src/index.tsx',
    'src/index.js',
    'main.ts',
    'main.tsx',
    'main.js',
    'index.ts',
    'index.tsx',
    'index.js',
    'src/App.tsx',
    'src/App.ts',
    'app.tsx',
    'app.ts',
    'main.cpp',
    'main.py',
    'main.c',
    'main.cs',
  ];

  for (const candidate of candidates) {
    if (keys.has(candidate) && !entries.includes(candidate)) {
      entries.push(candidate);
    }
  }

  return entries.slice(0, 8);
}
