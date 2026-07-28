import { ParseError, UnsupportedGoalError, type StructuredGoal } from './types';

const FRAMEWORKS: Record<string, string> = {
  three: 'three.js',
  'three.js': 'three.js',
  threejs: 'three.js',
};

const LANGUAGES: Record<string, string> = {
  typescript: 'typescript',
  ts: 'typescript',
  javascript: 'javascript',
};

const BUNDLERS: Record<string, string> = {
  vite: 'vite',
};

function match(text: string, map: Record<string, string>): string | null {
  for (const [keyword, value] of Object.entries(map)) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    if (re.test(text)) {
      return value;
    }
  }
  return null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'nova-project';
}

export function parseGoal(message: string): StructuredGoal {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    throw new ParseError('Message is empty');
  }

  const lower = trimmed.toLowerCase();

  const framework = match(lower, FRAMEWORKS);
  if (framework === null) {
    throw new UnsupportedGoalError(`No supported framework found in: "${trimmed}"`);
  }

  const language = match(lower, LANGUAGES) ?? 'typescript';
  const bundler = match(lower, BUNDLERS) ?? 'vite';

  const projectName = slugify(trimmed);

  return { projectName, framework, language, bundler, raw: trimmed };
}
