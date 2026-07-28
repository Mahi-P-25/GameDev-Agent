import type { IntentAnalysis, LocatedFile } from './change-types';
import type { ProjectContext } from './types';

export function locateFiles(intent: IntentAnalysis, context: ProjectContext): LocatedFile[] {
  const located: LocatedFile[] = [];
  const seen = new Set<string>();

  if (intent.intent === 'explain' || intent.intent === 'debug') {
    for (const file of context.source.files) {
      const entryScore = context.source.entryPoints.includes(file.path) ? 10 : 0;
      located.push({ path: file.path, relevance: 'all project files', score: entryScore });
      seen.add(file.path);
    }
    located.sort((a, b) => b.score - a.score);
    return located;
  }

  for (const target of intent.targets) {
    const matchingFiles = context.source.files.filter((f) => {
      const lowerPath = f.path.toLowerCase();
      const lowerTarget = target.toLowerCase();
      return lowerPath.includes(lowerTarget) || lowerPath.endsWith(`/${lowerTarget}`) || lowerPath.endsWith(`\\${lowerTarget}`);
    });

    for (const file of matchingFiles) {
      if (!seen.has(file.path)) {
        const score = calculateScore(file.path, target, context);
        const relevance = buildRelevance(file.path, target, context);
        located.push({ path: file.path, relevance, score });
        seen.add(file.path);
      }
    }
  }

  const matchedPaths = new Set(located.map(f => f.path));
  for (const [importer, imported] of context.source.importGraph.edges) {
    if (matchedPaths.has(imported) && !seen.has(importer)) {
      located.push({ path: importer, relevance: `imports matched file`, score: 5 });
      seen.add(importer);
    }
  }

  if (located.length === 0 && context.source.entryPoints.length > 0) {
    for (const ep of context.source.entryPoints) {
      if (!seen.has(ep)) {
        located.push({ path: ep, relevance: 'entry point — no direct match for target', score: 5 });
        seen.add(ep);
      }
    }
  }

  if (located.length === 0) {
    for (const file of context.source.files.slice(0, 5)) {
      if (!seen.has(file.path)) {
        located.push({ path: file.path, relevance: 'fallback — no target match found', score: 1 });
        seen.add(file.path);
      }
    }
  }

  located.sort((a, b) => b.score - a.score);
  return located;
}

function calculateScore(filePath: string, target: string, context: ProjectContext): number {
  let score = 0;
  const lcPath = filePath.toLowerCase();
  const lcTarget = target.toLowerCase();

  if (lcPath.includes(lcTarget)) score += 10;
  if (lcPath.endsWith(`${lcTarget}.ts`) || lcPath.endsWith(`${lcTarget}.tsx`)) score += 20;
  if (context.source.entryPoints.includes(filePath)) score += 5;
  if (filePath.includes('manager') || filePath.includes('service') || filePath.includes('controller')) score += 3;

  const fileObj = context.source.files.find((f) => f.path === filePath);
  if (fileObj && fileObj.imports.some((imp) => imp.toLowerCase().includes(lcTarget))) score += 5;

  return score;
}

function buildRelevance(filePath: string, target: string, context: ProjectContext): string {
  const lcPath = filePath.toLowerCase();
  const lcTarget = target.toLowerCase();

  if (lcPath.endsWith(`${lcTarget}.ts`) || lcPath.endsWith(`${lcTarget}.tsx`)) return `direct match for "${target}"`;
  if (lcPath.includes(lcTarget)) return `path contains "${target}"`;

  const fileObj = context.source.files.find((f) => f.path === filePath);
  if (fileObj && fileObj.imports.some((imp) => imp.toLowerCase().includes(lcTarget))) {
    return `imports a module matching "${target}"`;
  }

  if (context.source.entryPoints.includes(filePath)) return `entry point`;
  return `related file`;
}
