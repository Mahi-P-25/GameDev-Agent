import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { join, relative, extname, basename, dirname } from 'node:path';
import type { SourceFile, DetectedSystem, SourceInfo } from './types';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', '.vite', 'build', 'out', '.cache', 'coverage', '.nyc_output']);

const ENTRY_POINT_NAMES = new Set([
  'index.ts', 'index.tsx', 'index.js', 'index.jsx',
  'main.ts', 'main.tsx', 'main.js', 'main.jsx',
  'App.tsx', 'App.ts', 'App.jsx', 'App.js',
]);

const SYSTEM_DIR_PATTERNS: Array<[RegExp, string]> = [
  [/[/\\]scenes?[/\\]/i, 'Scene Graph'],
  [/[/\\]systems?[/\\]/i, 'Systems'],
  [/[/\\]components?[/\\]/i, 'Components'],
  [/[/\\]managers?[/\\]/i, 'Managers'],
  [/[/\\]services?[/\\]/i, 'Services'],
  [/[/\\]controllers?[/\\]/i, 'Controllers'],
  [/[/\\]entities?[/\\]/i, 'Entities (ECS)'],
  [/[/\\]ecs[/\\]/i, 'ECS'],
  [/[/\\]core[/\\]/i, 'Core'],
  [/[/\\]utils?[/\\]/i, 'Utilities'],
  [/[/\\]helpers?[/\\]/i, 'Utilities'],
  [/[/\\]engine[/\\]/i, 'Engine'],
  [/[/\\]physics?[/\\]/i, 'Physics'],
  [/[/\\]rendering?[/\\]/i, 'Rendering'],
  [/[/\\]input[/\\]/i, 'Input'],
  [/[/\\]ui[/\\]/i, 'UI'],
  [/[/\\]audio[/\\]/i, 'Audio'],
  [/[/\\]networking?[/\\]/i, 'Networking'],
];

function collectSourceFiles(rootDir: string): string[] {
  const result: string[] = [];

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry) || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      let s: ReturnType<typeof statSync>;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        walk(full);
      } else if (s.isFile() && SOURCE_EXTENSIONS.has(extname(entry))) {
        result.push(full);
      }
    }
  }

  walk(rootDir);
  return result;
}

function parseImports(content: string): string[] {
  const imports: string[] = [];
  const importRe = /(?:import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))?)\s+from\s+)?['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(content)) !== null) {
    const specifier = match[1] ?? match[2];
    if (specifier) {
      imports.push(specifier);
    }
  }
  return imports;
}

function parseExports(content: string): string[] {
  const exports: string[] = [];
  const exportRe = /^export\s+(?:(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+\w+|{\s*[^}]*\s*}\s*(?:from\s+['"][^'"]+['"])?)/gm;
  let match: RegExpExecArray | null;
  while ((match = exportRe.exec(content)) !== null) {
    const exp = match[0].trim();
    exports.push(exp);
  }
  return exports;
}

function detectFileSystems(filePath: string, rootDir: string): string[] {
  const rel = relative(rootDir, filePath).replace(/\\/g, '/');
  const systems: string[] = [];
  for (const [pattern, name] of SYSTEM_DIR_PATTERNS) {
    if (pattern.test(rel)) {
      systems.push(name);
    }
  }
  return systems;
}

function detectEntryPoints(files: string[], rootDir: string, pkgJson: Record<string, unknown>): string[] {
  const entries: string[] = [];
  const seen = new Set<string>();

  const mainField = pkgJson.main as string | undefined;
  if (mainField) {
    const mainPath = join(rootDir, mainField);
    if (files.includes(mainPath) && !seen.has(mainPath)) {
      entries.push(mainPath);
      seen.add(mainPath);
    }
  }

  for (const file of files) {
    const name = basename(file);
    if (ENTRY_POINT_NAMES.has(name) && !seen.has(file)) {
      entries.push(file);
      seen.add(file);
    }
  }

  return entries;
}

function resolveRelativeImport(importer: string, specifier: string): string | null {
  const dir = dirname(importer);
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', ''];

  for (const ext of extensions) {
    const candidate = join(dir, specifier + ext);
    if (existsSync(candidate)) {
      const s = statSync(candidate);
      if (s.isFile()) return candidate;
    }
  }

  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    const candidate = join(dir, specifier, 'index' + ext);
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

export function scanSource(rootDir: string): SourceInfo {
  const files = collectSourceFiles(rootDir);
  if (files.length === 0) {
    return {
      fileCount: 0,
      files: [],
      importGraph: { nodes: [], edges: [] },
      entryPoints: [],
      systems: [],
    };
  }

  const fileContents = new Map<string, string>();
  for (const file of files) {
    try {
      fileContents.set(file, readFileSync(file, 'utf-8'));
    } catch {
      continue;
    }
  }

  const sourceFiles: SourceFile[] = [];
  const importMap = new Map<string, string[]>();

  for (const file of files) {
    const content = fileContents.get(file);
    if (content === undefined) continue;

    const rel = relative(rootDir, file);
    const imports = parseImports(content);
    const exports = parseExports(content);
    const systems = detectFileSystems(file, rootDir);

    importMap.set(file, imports);
    sourceFiles.push({ path: rel, imports, exports, systems });
  }

  const nodes: string[] = [];
  const edges: [string, string][] = [];
  const nodeSet = new Set<string>();

  for (const file of files) {
    const relFile = relative(rootDir, file);
    if (!nodeSet.has(relFile)) {
      nodes.push(relFile);
      nodeSet.add(relFile);
    }
  }

  for (const file of files) {
    const relFile = relative(rootDir, file);
    const imports = importMap.get(file) ?? [];

    for (const specifier of imports) {
      if (specifier.startsWith('.')) {
        const resolved = resolveRelativeImport(file, specifier);
        if (resolved) {
          const relResolved = relative(rootDir, resolved);
          if (nodeSet.has(relResolved)) {
            edges.push([relFile, relResolved]);
          }
        }
      }
    }
  }

  let pkgJson: Record<string, unknown> = {};
  const pkgPath = join(rootDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      pkgJson = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    } catch {
      // ignore
    }
  }

  const entryPoints = detectEntryPoints(files, rootDir, pkgJson);
  const entryRel = entryPoints.map((e) => relative(rootDir, e));

  const systemMap = new Map<string, Set<string>>();
  for (const file of sourceFiles) {
    for (const sys of file.systems) {
      if (!systemMap.has(sys)) systemMap.set(sys, new Set());
      systemMap.get(sys)!.add(file.path);
    }
  }

  const systems: DetectedSystem[] = [];
  for (const [name, fileSet] of systemMap) {
    systems.push({
      name,
      files: Array.from(fileSet),
      description: `${fileSet.size} file(s) in ${name.toLowerCase()} area`,
    });
  }

  return {
    fileCount: sourceFiles.length,
    files: sourceFiles,
    importGraph: { nodes, edges },
    entryPoints: entryRel,
    systems,
  };
}
