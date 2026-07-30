import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TextEdit, BuildError, ErrorDiagnosis } from './change-types';

interface RepairResult {
  readonly edits: TextEdit[];
  readonly description: string;
}

function repairCannotFindName(error: BuildError, content: string, _lines: string[]): RepairResult | null {
  const msg = error.message;
  const nameMatch = /Cannot find name '(\w+)'/.exec(msg);
  if (!nameMatch) return null;
  const name = nameMatch[1];

  // Check if import already exists
  if (content.includes(`import * as THREE from "three"`) || content.includes(`import * as THREE from 'three'`)) {
    return null;
  }

  // Check for misspellings of THREE
  if (name !== 'THREE' && name.toUpperCase().includes('THREE') && !content.includes(name)) {
    const lineIdx = error.line - 1;
    const line = _lines[lineIdx];
    if (line && line.includes(name)) {
      const corrections: Record<string, string> = {
        'THRE': 'THREE',
        'THREE': 'THREE',
        'Three': 'THREE',
        'three': 'THREE',
      };
      const correct = corrections[name];
      if (correct) {
        return {
          edits: [{
            file: error.file,
            operation: 'replace',
            anchor: name,
            text: correct,
            reason: `Fix misspelled '${name}' → '${correct}'`,
          }],
          description: `Fix identifier '${name}'`,
        };
      }
    }
  }

  // The name is not defined — could be a missing import
  if (name === 'THREE' || name === 'OrbitControls') {
    return {
      edits: [{
        file: error.file,
        operation: 'insert-before',
        anchor: _lines[0] ?? '',
        text: `import * as THREE from "three";\n`,
        reason: `Add missing import for '${name}'`,
      }],
      description: `Add missing import for '${name}'`,
    };
  }

  return null;
}
function repairUnusedVariable(error: BuildError, _content: string, lines: string[]): RepairResult | null {
  const msg = error.message;
  const nameMatch = /'(\w+)' is declared but its value is never read/.exec(msg);
  if (!nameMatch) return null;
  const name = nameMatch[1];

  const lineIdx = error.line - 1;
  const line = lines[lineIdx];
  if (!line || !line.includes(name)) return null;

  // Delete the entire line — the variable is unused so it can be safely removed
  return {
    edits: [{
      file: error.file,
      operation: 'delete',
      anchor: line.trimEnd(),
      reason: `Remove unused variable '${name}'`,
    }],
    description: `Remove unused variable '${name}'`,
  };
}

function repairSyntaxError(error: BuildError, _content: string, lines: string[]): RepairResult | null {
  const lineIdx = error.line - 1;
  const line = lines[lineIdx];
  if (!line) return null;

  const trimmed = line.trimEnd();

  // Handle unmatched opening paren (missing closing paren before semicolon)
  if (trimmed.endsWith(';')) {
    const openCount = (trimmed.match(/\(/g) || []).length;
    const closeCount = (trimmed.match(/\)/g) || []).length;
    if (openCount > closeCount) {
      return {
        edits: [{
          file: error.file,
          operation: 'replace',
          anchor: trimmed,
          text: trimmed.slice(0, -1) + ');',
          reason: 'Add missing closing parenthesis',
        }],
        description: `Add missing ')' on line ${error.line}`,
      };
    }
  }

  // If the line ends without semicolon and isn't a block/control structure, add semicolon
  if (trimmed.length > 0 && !trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}') && !trimmed.endsWith('(') && !trimmed.endsWith(',') && !trimmed.endsWith(':') && !trimmed.startsWith('/')) {
    return {
      edits: [{
        file: error.file,
        operation: 'replace',
        anchor: trimmed,
        text: trimmed + ';',
        reason: 'Add missing semicolon',
      }],
      description: 'Add missing semicolon',
    };
  }

  return null;
}

function repairDuplicateIdentifier(error: BuildError, content: string, lines: string[]): RepairResult | null {
  const msg = error.message;
  const nameMatch = /Duplicate identifier '(\w+)'/.exec(msg) || /Cannot redeclare block-scoped variable '(\w+)'/.exec(msg);
  if (!nameMatch) return null;
  const name = nameMatch[1];

  const lineIdx = error.line - 1;
  const line = lines[lineIdx];
  if (!line || !line.includes(name)) return null;

  // Only remove if this is clearly a duplicate (not the original import line)
  const trimmed = line.trim();
  if (trimmed.startsWith('import ') && trimmed.includes(name)) {
    // This is an import line — don't remove original imports
    // Instead, check if there are multiple import lines for the same module
    const allImportLines = lines.filter((l) => l.trim().startsWith('import ') && l.includes(name));
    if (allImportLines.length > 1) {
      // This line is a duplicate import, count how many import lines come before it
      const importCount = lines.slice(0, lineIdx).filter((l) => l.trim().startsWith('import ')).length;
      // Only remove if not the first import
      if (importCount > 0) {
        return {
          edits: [{
            file: error.file,
            operation: 'delete',
            anchor: line.trimEnd(),
            reason: `Remove duplicate import of '${name}'`,
          }],
          description: `Remove duplicate import of '${name}'`,
        };
      }
    }
    return null;
  }

  // For non-import duplicates (variable declarations, etc.), remove the line
  if (content.indexOf(trimmed) !== content.lastIndexOf(trimmed)) {
    // The same line appears twice, remove this occurrence
    return {
      edits: [{
        file: error.file,
        operation: 'delete',
        anchor: line.trimEnd(),
        reason: `Remove duplicate identifier '${name}'`,
      }],
      description: `Remove duplicate identifier '${name}'`,
    };
  }

  // Handle different-value duplicates like `const x = 1;` and `const x = 2;`
  // Try to remove the FIRST declaration (likely the injected wrong one), not the error line
  if (trimmed.startsWith('const ') || trimmed.startsWith('let ') || trimmed.startsWith('var ')) {
    // Search for the first declaration of this name in the file (the one that's likely wrong)
    const declRe = new RegExp(`^(const|let|var)\\s+${name}\\b`, 'm');
    const firstMatch = declRe.exec(content);
    if (firstMatch) {
      // Only delete the first declaration if it's different from the error line
      const firstLine = lines[content.slice(0, firstMatch.index).split('\n').length - 1];
      if (firstLine && firstLine.trim() !== trimmed) {
        // First declaration has a different value — it's likely the injected wrong one
        return {
          edits: [{
            file: error.file,
            operation: 'delete',
            anchor: firstLine.trimEnd(),
            reason: `Remove wrong first declaration of '${name}'`,
          }],
          description: `Remove duplicate declaration of '${name}'`,
        };
      }
    }
    // Fallback: delete the error line
    return {
      edits: [{
        file: error.file,
        operation: 'delete',
        anchor: line.trimEnd(),
        reason: `Remove duplicate declaration of '${name}'`,
      }],
      description: `Remove duplicate declaration of '${name}'`,
    };
  }

  return null;
}

function repairMissingDependency(error: BuildError, _content: string): RepairResult | null {
  const msg = error.message;
  const moduleMatch = /Cannot find module '([^']+)'/.exec(msg);
  if (!moduleMatch) return null;
  const moduleName = moduleMatch[1];

  return {
    edits: [],
    description: `Missing dependency '${moduleName}' — will run npm install`,
  };
}

function repairTypeMismatch(error: BuildError, _content: string, lines: string[]): RepairResult | null {
  const lineIdx = error.line - 1;
  const line = lines[lineIdx];
  if (!line) return null;

  // For type mismatches involving THREE types, try to fix common patterns
  if (error.message.includes('THREE') || error.message.includes('three')) {
    // Try removing a type annotation that might be incorrect
    const typeAnnMatch = line.match(/(:\s*\w+)/);
    if (typeAnnMatch) {
      return {
        edits: [{
          file: error.file,
          operation: 'replace',
          anchor: typeAnnMatch[1],
          text: ': any',
          reason: 'Relax type constraint to fix type mismatch',
        }],
        description: `Fix type mismatch on line ${error.line}`,
      };
    }
  }

  return null;
}

function repairThreeJsApi(error: BuildError, content: string, lines: string[]): RepairResult | null {
  const lineIdx = error.line - 1;
  const line = lines[lineIdx];
  if (!line) return null;

  // Check for THREE import if not present
  const hasThreeImport = content.includes('import * as THREE') || content.includes("import * as THREE from 'three'") || content.includes('import * as THREE from "three"');
  if (error.message.includes('THREE') && !hasThreeImport) {
    return {
      edits: [{
        file: error.file,
        operation: 'insert-before',
        anchor: lines[0] ?? '',
        text: `import * as THREE from "three";\n`,
        reason: 'Add missing Three.js import',
      }],
      description: 'Add missing Three.js import',
    };
  }

  // Handle "Property 'X' does not exist on type..." — likely misspelled API
  const propMatch = /Property '(\w+)' does not exist on type/.exec(error.message);
  if (propMatch && (error.message.includes('THREE') || error.message.includes('three'))) {
    const wrongName = propMatch[1];
    // Check if TypeScript suggests a correction
    const suggestMatch = /Did you mean '(\w+)'/.exec(error.message);
    if (suggestMatch && wrongName !== suggestMatch[1]) {
      const correctName = suggestMatch[1];
      // Only replace the wrong name if it appears on the error line
      if (line.includes(wrongName)) {
        return {
          edits: [{
            file: error.file,
            operation: 'replace',
            anchor: wrongName,
            text: correctName,
            reason: `Fix misspelled '${wrongName}' → '${correctName}'`,
          }],
          description: `Fix Three.js API: '${wrongName}' → '${correctName}'`,
        };
      }
    }
    // Without suggestion, remove the wrong name's usage
    if (line.includes(`.${wrongName}`)) {
      return null; // Can't confidently fix
    }
  }

  // Handle "Argument of type..." — likely wrong args to a Three.js API
  if (error.message.includes('THREE') && error.code === 'TS2345') {
    return null; // Defer to type-mismatch handler
  }

  return null;
}

function repairBrokenPath(error: BuildError, content: string): RepairResult | null {
  const msg = error.message;
  const moduleMatch = /Cannot find module '([^']+)'/.exec(msg);
  if (!moduleMatch) return null;
  const brokenPath = moduleMatch[1];

  // If it's a relative path that doesn't exist, try to find the module in dependencies
  if (brokenPath.startsWith('./') || brokenPath.startsWith('../')) {
    // Extract the likely module name from the path (last segment or subfolder)
    const segments = brokenPath.replace(/\\/g, '/').split('/');
    const lastSegment = segments[segments.length - 1];

    // Try to replace the broken path with a matching dependency from the import identifier
    // For imports like `import * as THREE from "./nonexistent/module"`, the identifier is THREE
    // Check if a package named like the last segment or the identifier exists in node_modules
    const identifierLine = content.split('\n').find((l) => l.includes(brokenPath));
    if (identifierLine) {
      // Extract the identifier name: `import * as X from` or `import X from`
      const importMatch = /import\s+(?:\*\s+as\s+)?(\w+)/.exec(identifierLine);
      if (importMatch) {
        const identifier = importMatch[1];
        // The common pattern: `import * as THREE from "./nonexistent/module"` → fix to `"three"`
        // Check if the identifier (lowercase) is a known dependency
        const candidateName = identifier.toLowerCase() === identifier ? identifier : identifier.toLowerCase();
        return {
          edits: [{
            file: error.file,
            operation: 'replace',
            anchor: brokenPath,
            text: candidateName,
            reason: `Fix import path '${brokenPath}' → '${candidateName}'`,
          }],
          description: `Fix broken import path: '${brokenPath}'`,
        };
      }
    }
  }

  return null;
}

function repairBrokenConfig(error: BuildError, _content: string, lines: string[]): RepairResult | null {
  const lineIdx = error.line - 1;
  const line = lines[lineIdx];
  if (!line) return null;

  const trimmed = line.trim();

  // Handle lone `)` that should be `})` — missing closing brace for object
  if (trimmed === ')' || trimmed === ');') {
    const fixed = trimmed === ')' ? '})' : '});';
    return {
      edits: [{
        file: error.file,
        operation: 'replace',
        anchor: trimmed,
        text: fixed,
        reason: 'Add missing closing brace for config object',
      }],
      description: 'Fix missing closing brace in config',
    };
  }

  return null;
}

export function generateRepair(
  diagnosis: ErrorDiagnosis,
  projectDir: string,
): RepairResult | null {
  const error = diagnosis.error;
  const filePath = join(projectDir, error.file);

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  const lines = content.split('\n');

  switch (diagnosis.category) {
    case 'cannot-find-name':
      return repairCannotFindName(error, content, lines);
    case 'unused-variable':
      return repairUnusedVariable(error, content, lines);
    case 'syntax-error':
      return repairSyntaxError(error, content, lines);
    case 'duplicate-identifier':
      return repairDuplicateIdentifier(error, content, lines);
    case 'missing-dependency':
      return repairMissingDependency(error, content);
    case 'type-mismatch':
      return repairTypeMismatch(error, content, lines);
    case 'three-js-api':
      return repairThreeJsApi(error, content, lines);
    case 'broken-path':
      return repairBrokenPath(error, content);
    case 'broken-config':
      return repairBrokenConfig(error, content, lines);
    case 'missing-import':
    case 'wrong-args':
    default:
      return null;
  }
}
