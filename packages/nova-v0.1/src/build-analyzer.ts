import type { BuildError, ErrorCategory, ErrorDiagnosis } from './change-types';

const TS_ERROR_RE = /(?:^|\n)\s*(.+?)\((\d+),(\d+)\):\s*(error)\s+(TS\d+):\s+(.+)/g;
const TS_ERROR_RE2 = /(?:^|\n)\s*(.+?):(\d+):(\d+)\s*-\s*(error)\s+(TS\d+):\s+(.+)/g;
const CANNOT_FIND_MODULE_RE = /Cannot find module '([^']+)'/;
const CANNOT_FIND_NAME_RE = /Cannot find name '([^']+)'/;
const UNUSED_VAR_RE = /'(\w+)' is declared but its value is never read/;
const MISSING_SEMICOLON_RE = /';' expected/;
const DUPLICATE_ID_RE = /Duplicate identifier '(\w+)'/;
const MISSING_DEP_RE = /Cannot find module\s+'([^']+)' or its corresponding type declarations/;
const WRONG_ARGS_RE = /Expected (\d+) arguments?, but got (\d+)/;
// Non-tsc error patterns from Vite/rolldown
const ROLLDOWN_RESOLVE_RE = /Rolldown failed to resolve import "([^"]+)" from "([^"]+)"/;
const PARSE_ERROR_RE = /\[PARSE_ERROR\]/;

export function parseBuildErrors(output: string): BuildError[] {
  const errors: BuildError[] = [];
  const seen = new Set<string>();

  // Strip ANSI escape codes for reliable regex matching
  const clean = output.replace(/\u001b\[[\d;]*[a-zA-Z]/g, '').replace(/\u001b/g, '');

  const lines = clean.split('\n');

  for (const line of lines) {
    if (!line.includes('error') && !line.includes('Error') && !line.includes('ERROR') && !line.includes('PARSE_ERROR')) continue;

    let match: RegExpExecArray | null;

    TS_ERROR_RE.lastIndex = 0;
    match = TS_ERROR_RE.exec(line);
    if (match) {
      const [, file, lineStr, colStr, , code, message] = match;
      // Normalize file path — remove extra whitespace
      const f = file.trim();
      const key = `${f}:${lineStr}:${code}:${message.slice(0, 40)}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({
          file: f.replace(/^(\.\/|\.\\)/, ''),
          line: Number.parseInt(lineStr, 10),
          column: Number.parseInt(colStr, 10),
          code,
          message: message.trim(),
          raw: line.trim(),
        });
      }
      continue;
    }

    TS_ERROR_RE2.lastIndex = 0;
    match = TS_ERROR_RE2.exec(line);
    if (match) {
      const [, file, lineStr, colStr, , code, message] = match;
      const f = file.trim();
      const key = `${f}:${lineStr}:${code}:${message.slice(0, 40)}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({
          file: f.replace(/^(\.\/|\.\\)/, ''),
          line: Number.parseInt(lineStr, 10),
          column: Number.parseInt(colStr, 10),
          code,
          message: message.trim(),
          raw: line.trim(),
        });
      }
      continue;
    }

    // Vite/rolldown: Rolldown failed to resolve import "module" from "path"
    ROLLDOWN_RESOLVE_RE.lastIndex = 0;
    match = ROLLDOWN_RESOLVE_RE.exec(line);
    if (match) {
      const moduleName = match[1];
      const filePath = match[2].replace(/\\/g, '/');
      const fileName = filePath.split('/').pop() ?? 'unknown.ts';
      // Extract relative filename from the full path
      const relativeFile = fileName;
      const key = `resolve:${moduleName}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({
          file: relativeFile,
          line: 1,
          column: 1,
          code: 'VITE_RESOLVE',
          message: `Cannot find module '${moduleName}'`,
          raw: line.trim(),
        });
      }
      continue;
    }

    // Vite/rolldown: config parse errors
    if (PARSE_ERROR_RE.test(line)) {
      // Check the next line for the format ╭─[ file:line:col ]─╯ or ─[ file:line:col ]─
      const currentIdx = lines.indexOf(line);
      let parseFile: string | undefined;
      let parseLine = 1;
      let parseCol = 1;
      const parseFileMatch = line.match(/[╭─]─?\[ (.+?):(\d+):(\d+) \]─?[╯]?/);
      if (parseFileMatch) {
        parseFile = parseFileMatch[1].trim();
        parseLine = Number.parseInt(parseFileMatch[2], 10);
        parseCol = Number.parseInt(parseFileMatch[3], 10);
      } else if (currentIdx >= 0 && currentIdx + 1 < lines.length) {
        const nextLine = lines[currentIdx + 1];
        const nextMatch = nextLine.match(/[╭─]─?\[ (.+?):(\d+):(\d+) \]─?[╯]?/);
        if (nextMatch) {
          parseFile = nextMatch[1].trim();
          parseLine = Number.parseInt(nextMatch[2], 10);
          parseCol = Number.parseInt(nextMatch[3], 10);
        }
      }
      if (parseFile) {
        const key = `parse:${parseFile}:${parseLine}`;
        if (!seen.has(key)) {
          seen.add(key);
          errors.push({
            file: parseFile,
            line: parseLine,
            column: parseCol,
            code: 'PARSE_ERROR',
            message: line.trim(),
            raw: line.trim(),
          });
        }
      }
    }
  }

  return errors;
}

export function diagnoseError(error: BuildError): ErrorDiagnosis {
  const msg = error.message;
  const code = error.code;

  if (code === 'TS2307' || msg.includes("Cannot find module")) {
    const match = CANNOT_FIND_MODULE_RE.exec(msg) ?? CANNOT_FIND_MODULE_RE2(msg);
    const moduleName = match?.[1] ?? 'unknown';
    if (moduleName.startsWith('.') || moduleName.startsWith('/')) {
      return {
        error,
        category: 'broken-path',
        rootCause: `Import path '${moduleName}' points to a non-existent file`,
        confidence: 0.9,
      };
    }
    return {
      error,
      category: 'missing-dependency',
      rootCause: `Dependency '${moduleName}' is not installed or missing from package.json`,
      confidence: 0.9,
    };
  }

  if (code === 'TS2304' || msg.includes("Cannot find name")) {
    const match = CANNOT_FIND_NAME_RE.exec(msg);
    const name = match?.[1] ?? 'unknown';
    return {
      error,
      category: 'cannot-find-name',
      rootCause: `Identifier '${name}' is not defined in scope — may be misspelled or missing import`,
      confidence: 0.85,
    };
  }

  if (code === 'TS6133' || msg.includes("declared but its value is never read")) {
    const match = UNUSED_VAR_RE.exec(msg);
    const name = match?.[1] ?? 'variable';
    return {
      error,
      category: 'unused-variable',
      rootCause: `Variable '${name}' is declared but never used`,
      confidence: 0.95,
    };
  }

  if (code === 'TS1005' || msg.includes("';' expected")) {
    return {
      error,
      category: 'syntax-error',
      rootCause: 'Missing semicolon or syntax error at this location',
      confidence: 0.8,
    };
  }

  if (code === 'TS2300' || code === 'TS2451' || msg.includes('Duplicate identifier') || msg.includes('Cannot redeclare')) {
    const match = DUPLICATE_ID_RE.exec(msg) || /Cannot redeclare block-scoped variable '(\w+)'/.exec(msg);
    const name = match?.[1] ?? 'unknown';
    return {
      error,
      category: 'duplicate-identifier',
      rootCause: `Duplicate identifier '${name}' — already declared in this scope`,
      confidence: 0.9,
    };
  }

  if (code === 'TS2554' || msg.includes('Expected')) {
    const match = WRONG_ARGS_RE.exec(msg);
    if (match) {
      return {
        error,
        category: 'wrong-args',
        rootCause: `Function called with ${match[2]} arguments but expected ${match[1]}`,
        confidence: 0.85,
      };
    }
  }

  if (code === 'TS2322' || msg.includes("not assignable")) {
    return {
      error,
      category: 'type-mismatch',
      rootCause: `Type mismatch: ${msg}`,
      confidence: 0.8,
    };
  }

  if (code === 'TS2345' || msg.includes("Argument of type")) {
    return {
      error,
      category: 'type-mismatch',
      rootCause: `Wrong argument type: ${msg}`,
      confidence: 0.8,
    };
  }

  if (error.code === 'VITE_RESOLVE' || msg.includes('Rolldown failed to resolve')) {
    const match = CANNOT_FIND_MODULE_RE.exec(msg);
    const moduleName = match?.[1] ?? 'unknown';
    return {
      error,
      category: 'missing-dependency',
      rootCause: `Dependency '${moduleName}' is not installed or missing from package.json`,
      confidence: 0.9,
    };
  }

  if (error.code === 'PARSE_ERROR' || msg.includes('PARSE_ERROR')) {
    return {
      error,
      category: 'broken-config',
      rootCause: `Configuration file has a syntax error: ${msg}`,
      confidence: 0.9,
    };
  }

  if (msg.includes('THREE') || msg.includes('three')) {
    return {
      error,
      category: 'three-js-api',
      rootCause: `Three.js API usage error: ${msg}`,
      confidence: 0.7,
    };
  }

  return {
    error,
    category: 'unknown',
    rootCause: `Unclassified error: ${msg}`,
    confidence: 0.3,
  };
}

function CANNOT_FIND_MODULE_RE2(msg: string): RegExpExecArray | null {
  return /Cannot find module '([^']+)'/.exec(msg);
}
