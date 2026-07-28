import type { IntentAnalysis, ChangeIntent } from './change-types';
import type { ProjectContext } from './types';

const INTENT_PATTERNS: Array<{ keywords: RegExp[]; intent: ChangeIntent }> = [
  { keywords: [/^add\b/i, /^create\b/i, /^new\b/i, /\binsert\b/i, /\bintroduce\b/i], intent: 'create' },
  { keywords: [/^modify\b/i, /^change\b/i, /^update\b/i, /^improve\b/i, /^enhance\b/i, /^fix\b/i, /^adjust\b/i], intent: 'modify' },
  { keywords: [/^remove\b/i, /^delete\b/i, /^drop\b/i, /^strip\b/i, /^clean\b/i], intent: 'delete' },
  { keywords: [/^refactor\b/i, /^restructure\b/i, /^extract\b/i, /^reorganize\b/i, /^simplify\b/i], intent: 'refactor' },
  { keywords: [/^optimize\b/i, /^speed up\b/i, /^improve performance\b/i, /^reduce\b.*\b(alloc|memory|size)/i], intent: 'optimize' },
  { keywords: [/^explain\b/i, /^describe\b/i, /^what\b/i, /^how\b/i, /^analyze\b/i, /^show\b/i], intent: 'explain' },
  { keywords: [/^debug\b/i, /^find bug\b/i, /^investigate\b/i, /^why\b/i], intent: 'debug' },
];

function classifyIntent(request: string): { intent: ChangeIntent; confidence: number } {
  const trimmed = request.trim();
  for (const { keywords, intent } of INTENT_PATTERNS) {
    for (const re of keywords) {
      if (re.test(trimmed)) {
        return { intent, confidence: 0.8 };
      }
    }
  }
  return { intent: 'modify', confidence: 0.5 };
}

function extractTargets(request: string, context: ProjectContext): string[] {
  const targets: string[] = [];
  const lower = request.toLowerCase();

  const stopwords = new Set(['the', 'a', 'an', 'this', 'that', 'these', 'those', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'add', 'create', 'modify', 'change', 'update', 'improve', 'remove', 'delete', 'refactor', 'optimize', 'explain', 'debug', 'please', 'make', 'get', 'set', 'put', 'let', 'help']);

  const words = lower.replace(/[^a-z0-9\s.-]/g, '').split(/\s+/).filter(Boolean);

  for (const word of words) {
    if (stopwords.has(word) || word.length < 2) continue;

    const matchedFileName = context.source.files.find((f) => {
      const lowerPath = f.path.toLowerCase();
      return lowerPath.includes(word) || lowerPath.includes(word.replace('-', '/'));
    });

    if (matchedFileName) {
      if (!targets.includes(matchedFileName.path)) {
        targets.push(matchedFileName.path);
      }
      continue;
    }

    if (context.source.systems.some((s) => s.name.toLowerCase().includes(word))) {
      if (!targets.includes(word)) targets.push(word);
      continue;
    }

    if (!targets.includes(word)) targets.push(word);
  }

  return targets;
}

export function analyzeIntent(request: string, context: ProjectContext): IntentAnalysis {
  const { intent, confidence } = classifyIntent(request);
  const targets = extractTargets(request, context);

  const description = targets.length > 0
    ? `${intent} related to: ${targets.join(', ')}`
    : `${intent} based on request`;

  return { intent, targets, description, confidence };
}
