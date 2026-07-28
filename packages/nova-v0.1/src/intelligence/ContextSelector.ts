import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectContext } from '../types';
import type { SelectedContext } from './types';

const MAX_CONTEXT_BYTES = 80_000;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function computeRelevanceScore(filePath: string, keywords: readonly string[]): number {
  const lower = filePath.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) score += 10;
    if (lower.endsWith(`/${kw}.ts`) || lower.endsWith(`\\${kw}.ts`)) score += 20;
    if (lower.endsWith(`/${kw}.tsx`) || lower.endsWith(`\\${kw}.tsx`)) score += 20;
  }
  return score;
}

function extractKeywords(request: string): string[] {
  const stopwords = new Set(['the', 'a', 'an', 'this', 'that', 'in', 'on', 'to', 'for', 'of', 'with', 'and', 'or', 'but', 'is', 'are', 'add', 'create', 'modify', 'change', 'update', 'remove', 'delete', 'refactor', 'optimize', 'explain', 'debug', 'please', 'make', 'get', 'set', 'help']);
  return request
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w));
}

export function selectContext(context: ProjectContext, request: string): SelectedContext {
  const keywords = extractKeywords(request);
  const scored: Array<{ path: string; score: number }> = [];
  const seen = new Set<string>();

  for (const file of context.source.files) {
    const score = computeRelevanceScore(file.path, keywords);
    if (score > 0) {
      scored.push({ path: file.path, score });
      seen.add(file.path);
    }
  }

  const entryPoints = context.source.entryPoints.filter((ep) => !seen.has(ep));
  for (const ep of entryPoints) {
    scored.push({ path: ep, score: 5 });
    seen.add(ep);
  }

  for (const file of context.source.files) {
    if (!seen.has(file.path)) {
      const keywordMatch = keywords.some((kw) =>
        file.imports.some((imp) => imp.toLowerCase().includes(kw)) ||
        file.exports.some((exp) => exp.toLowerCase().includes(kw)),
      );
      if (keywordMatch) {
        scored.push({ path: file.path, score: 3 });
        seen.add(file.path);
      }
    }
  }

  if (scored.length < 3) {
    for (const file of context.source.files) {
      if (!seen.has(file.path)) {
        scored.push({ path: file.path, score: 1 });
        seen.add(file.path);
        if (scored.length >= 8) break;
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const files: Array<{ path: string; content: string }> = [];
  let totalBytes = 0;
  const baseDir = context.projectPath;

  for (const entry of scored) {
    const fullPath = join(baseDir, entry.path);
    if (!existsSync(fullPath)) continue;
    const content = readFileSync(fullPath, 'utf-8');
    const needed = totalBytes + content.length + 200;
    if (needed > MAX_CONTEXT_BYTES && files.length >= 1) break;
    files.push({ path: entry.path, content });
    totalBytes += content.length + 200;
  }

  const architectureParts: string[] = [];
  architectureParts.push(`Pattern: ${context.architecture.pattern}`);
  if (context.architecture.managers.length > 0) {
    architectureParts.push(`Managers: ${context.architecture.managers.join(', ')}`);
  }
  if (context.architecture.services.length > 0) {
    architectureParts.push(`Services: ${context.architecture.services.join(', ')}`);
  }
  if (context.architecture.components.length > 0) {
    architectureParts.push(`Components: ${context.architecture.components.join(', ')}`);
  }
  if (context.architecture.systems.length > 0) {
    architectureParts.push(`Systems: ${context.architecture.systems.join(', ')}`);
  }

  const importsGraphParts: string[] = [];
  for (const file of context.source.files.slice(0, 15)) {
    if (file.imports.length > 0) {
      importsGraphParts.push(`${file.path} → ${file.imports.join(', ')}`);
    }
  }

  const conventionsParts: string[] = [];
  if (context.repo.language) conventionsParts.push(`Language: ${context.repo.language}`);
  if (context.repo.framework) conventionsParts.push(`Framework: ${context.repo.framework}`);
  if (context.repo.buildSystem) conventionsParts.push(`Build: ${context.repo.buildSystem}`);
  if (context.repo.packageManager) conventionsParts.push(`Package Manager: ${context.repo.packageManager}`);

  return {
    files,
    architecture: architectureParts.join('\n'),
    conventions: conventionsParts.join('\n'),
    importsGraph: importsGraphParts.join('\n'),
    totalBytes,
    estimatedTokens: estimateTokens(
      files.map((f) => f.content).join('\n') +
      architectureParts.join('\n') +
      conventionsParts.join('\n') +
      importsGraphParts.join('\n'),
    ),
  };
}