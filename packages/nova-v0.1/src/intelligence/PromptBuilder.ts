import type { IntelligenceTaskType, SelectedContext, BuiltPrompt } from './types';

const OUTPUT_SCHEMA = `{
  "summary": "brief explanation of the changes",
  "changes": [
    {
      "file": "relative/path/to/file.ts",
      "operation": "insert-before | insert-after | replace | delete | create",
      "anchor": "exact text to anchor the edit near",
      "text": "the code to insert (or replacement text)",
      "reason": "why this change is needed"
    }
  ]
}`;

const TASK_INSTRUCTIONS: Record<IntelligenceTaskType, string> = {
  generate: 'Generate new code or files. Prefer creating new files over modifying existing ones.',
  modify: 'Modify existing code. Change as little as possible to achieve the goal.',
  refactor: 'Refactor code without changing behavior. Preserve all existing functionality.',
  explain: 'Analyze and explain the code. Do not modify anything.',
  optimize: 'Optimize the code. Preserve behavior while improving performance.',
  debug: 'Find and fix bugs. Explain the root cause.',
};

export function buildPrompt(
  taskType: IntelligenceTaskType,
  request: string,
  selected: SelectedContext,
  constraints: string[],
): BuiltPrompt {
  const fileSections = selected.files.map((f) => {
    const ext = f.path.split('.').pop() ?? 'ts';
    return `--- ${f.path} (${ext}) ---\n${f.content}`;
  }).join('\n\n');

  const systemParts: string[] = [
    'You are Nova, an AI code modification engine. You produce structured, precise code edits.',
    '',
    '## Rules',
    '- Only modify files listed below.',
    '- Never add comments unless the code already has them.',
    '- Keep changes minimal and focused.',
    '- Match the existing code style exactly.',
    '- Never delete code unless explicitly asked.',
    '- Never leave placeholder comments or TODOs.',
    '',
    `## Task Type: ${taskType}`,
    TASK_INSTRUCTIONS[taskType],
    '',
    '## Output Format',
    `Respond with ONLY valid JSON matching this schema:\n${OUTPUT_SCHEMA}`,
    '',
    '## Constraints',
    ...constraints.map((c) => `- ${c}`),
    '',
    '## Verification Requirements',
    '- All imports must resolve to existing modules.',
    '- Braces and parentheses must be balanced.',
    '- The output must parse as valid TypeScript/JavaScript.',
    '- Do not introduce unused variables or imports.',
    '',
  ];

  const userParts: string[] = [
    `## Mission\n${request}`,
    '',
    '## Project Summary',
    selected.conventions ? `${selected.conventions}\n` : '',
    selected.architecture ? `Architecture:\n${selected.architecture}\n` : '',
    selected.importsGraph ? `Import Graph:\n${selected.importsGraph}\n` : '',
    '',
    '## Relevant Files',
    fileSections || '(no source files available — create new file)',
    '',
  ];

  const system = systemParts.join('\n');
  const user = userParts.join('\n');

  return {
    system,
    user,
    estimatedTokens: Math.ceil((system.length + user.length) / 4),
  };
}