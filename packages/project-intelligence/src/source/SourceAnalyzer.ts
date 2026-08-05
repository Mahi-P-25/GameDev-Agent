import { extensionOf, normalizePath } from '../shared/paths';
import type {
  FileIndex,
  PublicAPI,
  SourceFileAnalysis,
  SourceIndex,
  SymbolEntry,
  SymbolGraphEdge,
} from '../types';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']);

/** Captures module specifiers from the five common import forms. */
const IMPORT_RE =
  /(?:import\s+(?:type\s+)?(?:[\w*{},\s]+from\s+)?['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)|from\s+['"]([^'"]+)['"])/g;

/** Captures `export { a, b as c }` lists. */
const EXPORT_LIST_RE = /export\s*\{\s*([\s\S]*?)\s*\}/g;

/** Captures declaration keywords + names (optionally exported). */
const DECLARATION_RE =
  /(?:^|[;\n}{]\s*|\s)(export\s+)?(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(?:declare\s+)?(class|interface|function|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/g;

/** Captures the primary identifier of a named/default import clause. */
const IMPORT_SYMBOL_RE = /import\s+([^'"\n]+?)\s+from\s+['"]([^'"]+)['"]/g;

/**
 * Source Analyzer.
 *
 * Produces the symbol-level view of a project: per-file imports/exports and
 * declarations (classes, interfaces, functions, types), a flat symbol index, a
 * module {@link SymbolGraph}, and the aggregated public API surface. Analysis
 * is heuristic (regex-based) by design — cheap enough to run on every open.
 */
export class SourceAnalyzer {
  /** Analyze a file index into a {@link SourceIndex}. */
  analyze(files: FileIndex): SourceIndex {
    const sourcePaths = Object.keys(files).filter(isSourceFile).sort();

    const analyses: SourceFileAnalysis[] = [];
    const allSymbols: SymbolEntry[] = [];
    const edges: SymbolGraphEdge[] = [];
    const publicFiles = new Map<string, Set<string>>();
    const seenSymbols = new Set<string>();

    for (const filePath of sourcePaths) {
      const content = files[filePath] ?? '';
      const analysis = analyzeSourceFile(filePath, content);

      analyses.push(analysis);

      for (const symbol of analysis.symbols) {
        const key = `${symbol.kind}:${symbol.name}:${symbol.filePath}`;
        if (!seenSymbols.has(key)) {
          seenSymbols.add(key);
          allSymbols.push(symbol);
        }
      }

      for (const exported of analysis.exports) {
        let filesWithExport = publicFiles.get(exported);
        if (filesWithExport === undefined) {
          filesWithExport = new Set<string>();
          publicFiles.set(exported, filesWithExport);
        }
        filesWithExport.add(filePath);
      }

      const importSymbols = extractImportSymbols(content);
      for (const specifier of analysis.imports) {
        if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
          continue;
        }
        const resolved = resolveImport(filePath, specifier, sourcePaths);
        if (resolved !== null) {
          const symbol = importSymbols.get(specifier);
          edges.push(
            symbol !== undefined
              ? { from: filePath, to: resolved, symbol }
              : { from: filePath, to: resolved },
          );
        }
      }
    }

    return {
      files: analyses,
      totalImports: analyses.reduce((sum, analysis) => sum + analysis.imports.length, 0),
      totalExports: analyses.reduce((sum, analysis) => sum + analysis.exports.length, 0),
      classes: allSymbols.filter((s) => s.kind === 'class'),
      interfaces: allSymbols.filter((s) => s.kind === 'interface'),
      functions: allSymbols.filter((s) => s.kind === 'function'),
      types: allSymbols.filter((s) => s.kind === 'type'),
      symbols: allSymbols,
      graph: { nodes: sourcePaths, edges },
      publicApi: buildPublicApi(publicFiles),
    };
  }
}

/** Pure-function form of {@link SourceAnalyzer}. */
export function analyzeSource(files: FileIndex): SourceIndex {
  return new SourceAnalyzer().analyze(files);
}

function analyzeSourceFile(filePath: string, content: string): SourceFileAnalysis {
  const imports = [...new Set(extractImports(content))].sort();
  const declarations = extractDeclarations(filePath, content);
  const exportList = extractExportLists(content);
  const exports = [...new Set([...declarations.exports, ...exportList])].sort();

  return {
    path: filePath,
    imports,
    exports,
    classes: [...declarations.classes].sort(),
    interfaces: [...declarations.interfaces].sort(),
    functions: [...declarations.functions].sort(),
    types: [...declarations.types].sort(),
    symbols: declarations.symbols,
  };
}

function extractImports(content: string): string[] {
  const specifiers: string[] = [];
  IMPORT_RE.lastIndex = 0;
  for (let match = IMPORT_RE.exec(content); match !== null; match = IMPORT_RE.exec(content)) {
    for (let group = 1; group <= 5; group++) {
      const specifier = match[group];
      if (specifier !== undefined) {
        specifiers.push(specifier);
      }
    }
  }
  return specifiers;
}

function extractExportLists(content: string): string[] {
  const names: string[] = [];
  EXPORT_LIST_RE.lastIndex = 0;
  for (
    let match = EXPORT_LIST_RE.exec(content);
    match !== null;
    match = EXPORT_LIST_RE.exec(content)
  ) {
    const body = match[1];
    if (body === undefined) continue;
    for (const raw of body.split(',')) {
      const base =
        raw
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)[0] ?? '';
      const name = base.trim();
      if (name !== '' && /^[A-Za-z_$][\w$]*$/.test(name)) {
        names.push(name);
      }
    }
  }
  return names;
}

function extractDeclarations(
  filePath: string,
  content: string,
): {
  exports: string[];
  classes: string[];
  interfaces: string[];
  functions: string[];
  types: string[];
  symbols: SymbolEntry[];
} {
  const symbols: SymbolEntry[] = [];
  const classes = new Set<string>();
  const interfaces = new Set<string>();
  const functions = new Set<string>();
  const types = new Set<string>();
  const exports = new Set<string>();

  DECLARATION_RE.lastIndex = 0;
  for (
    let match = DECLARATION_RE.exec(content);
    match !== null;
    match = DECLARATION_RE.exec(content)
  ) {
    const exported = match[1] !== undefined;
    const keyword = match[2];
    const name = match[3];
    if (keyword === undefined || name === undefined) continue;

    const kind = kindFor(keyword);
    symbols.push({ name, kind, filePath });
    if (kind === 'class') classes.add(name);
    else if (kind === 'interface') interfaces.add(name);
    else if (kind === 'function') functions.add(name);
    else types.add(name);

    if (exported) {
      exports.add(name);
    }
  }

  if (/export\s+default\b/.test(content)) {
    exports.add('default');
  }

  return {
    exports: [...exports],
    classes: [...classes],
    interfaces: [...interfaces],
    functions: [...functions],
    types: [...types],
    symbols,
  };
}

function kindFor(keyword: string): SymbolEntry['kind'] {
  switch (keyword) {
    case 'class':
      return 'class';
    case 'interface':
      return 'interface';
    case 'function':
      return 'function';
    case 'type':
    case 'enum':
      return 'type';
    default:
      return 'variable';
  }
}

function extractImportSymbols(content: string): Map<string, string> {
  const map = new Map<string, string>();
  IMPORT_SYMBOL_RE.lastIndex = 0;
  for (
    let match = IMPORT_SYMBOL_RE.exec(content);
    match !== null;
    match = IMPORT_SYMBOL_RE.exec(content)
  ) {
    const clause = match[1];
    const specifier = match[2];
    if (clause === undefined || specifier === undefined) continue;
    if (map.has(specifier)) continue;
    const identifier = /[A-Za-z_$][\w$]*/.exec(clause)?.[0];
    if (identifier !== undefined) {
      map.set(specifier, identifier);
    }
  }
  return map;
}

function resolveImport(
  fromFile: string,
  specifier: string,
  sourcePaths: readonly string[],
): string | null {
  const normalizedFrom = normalizePath(fromFile);
  const slash = normalizedFrom.lastIndexOf('/');
  const baseDir = slash > 0 ? normalizedFrom.slice(0, slash) : '';
  const resolved = resolveRelativePath(baseDir, specifier);

  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.js`,
    `${resolved}.jsx`,
    `${resolved}.mjs`,
    `${resolved}.cjs`,
    `${resolved}/index.ts`,
    `${resolved}/index.tsx`,
    `${resolved}/index.js`,
    `${resolved}/index.mjs`,
  ];

  const sourceSet = new Set(sourcePaths);
  for (const candidate of candidates) {
    if (sourceSet.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveRelativePath(baseDir: string, relativePath: string): string {
  const parts = baseDir === '' ? [] : baseDir.split('/');
  for (const segment of relativePath.split('/')) {
    if (segment === '.' || segment === '') continue;
    if (segment === '..') parts.pop();
    else parts.push(segment);
  }
  return parts.join('/');
}

function buildPublicApi(publicFiles: Map<string, Set<string>>): PublicAPI {
  const files: Record<string, readonly string[]> = {};
  for (const [name, paths] of publicFiles) {
    files[name] = [...paths].sort();
  }
  return { names: [...publicFiles.keys()].sort(), files };
}

function isSourceFile(path: string): boolean {
  return SOURCE_EXTENSIONS.has(extensionOf(path));
}
