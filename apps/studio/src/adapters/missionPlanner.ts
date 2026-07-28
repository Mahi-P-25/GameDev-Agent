import type { MissionPlan, GoalCategory, Complexity, Technology, ToolDefinition, ExecutionStage, Risk, MissionAbility } from './missionPlannerTypes';

const GOAL_RULES: { readonly patterns: readonly RegExp[]; readonly category: GoalCategory; readonly priority: number }[] = [
  { patterns: [/^create\s+a/i, /^new\s+(game|project|world|scene)/i, /^build\s+a/i], category: 'create-project', priority: 10 },
  { patterns: [/(fix|bug|crash|glitch|jitter|broken|error|issue)/i], category: 'bug-fix', priority: 8 },
  { patterns: [/(optimize|performance|fps|memory|speed\s*up|lag|slow|bottleneck)/i], category: 'performance', priority: 8 },
  { patterns: [/(refactor|restructure|rewrite|clean\s*up|organize|reorganize)/i], category: 'refactor', priority: 7 },
  { patterns: [/(explain|analyze|review|audit|document|architecture|understand)/i], category: 'analysis', priority: 6 },
  { patterns: [/(add|implement|feature|integrate|support\s+for|introduce)/i], category: 'feature', priority: 5 },
];

const TECH_RULES: { readonly patterns: readonly RegExp[]; readonly name: string }[] = [
  { patterns: [/three\.?js/i], name: 'Three.js' },
  { patterns: [/react/i], name: 'React' },
  { patterns: [/typescript/i, /\.ts\b/i], name: 'TypeScript' },
  { patterns: [/blender/i], name: 'Blender' },
  { patterns: [/unity/i], name: 'Unity' },
  { patterns: [/unreal/i, /ue\d/i], name: 'Unreal Engine' },
  { patterns: [/godot/i], name: 'Godot' },
  { patterns: [/glsl/i, /shader/i], name: 'GLSL' },
  { patterns: [/c#|csharp/i], name: 'C#' },
  { patterns: [/python/i], name: 'Python' },
  { patterns: [/rust/i], name: 'Rust' },
  { patterns: [/node/i], name: 'Node.js' },
  { patterns: [/vite/i], name: 'Vite' },
  { patterns: [/webgl|webgpu/i], name: 'WebGL/WebGPU' },
  { patterns: [/physics|rapier|havok/i], name: 'Physics Engine' },
  { patterns: [/docker/i], name: 'Docker' },
  { patterns: [/git/i], name: 'Git' },
];

const INFERENCE_RULES: { readonly patterns: readonly RegExp[]; readonly technologies: readonly string[] }[] = [
  { patterns: [/3d\s*(game|scene|world|render|engine)/i], technologies: ['Three.js', 'GLSL'] },
  { patterns: [/racing\s*game/i], technologies: ['Three.js'] },
  { patterns: [/rpg|role\s*playing/i], technologies: ['Three.js'] },
  { patterns: [/game\s*engine/i], technologies: ['Three.js'] },
  { patterns: [/web\s*(app|site|application)/i], technologies: ['React', 'TypeScript'] },
  { patterns: [/mobile\s*(app|game)/i], technologies: ['React'] },
  { patterns: [/2d\s*(game|platformer)/i], technologies: ['Canvas 2D'] },
];

const STAGE_TEMPLATES: Record<GoalCategory, readonly { readonly id: string; readonly label: string; readonly description: string }[]> = {
  'create-project': [
    { id: 'planning', label: 'Planning', description: 'Defining project architecture and structure' },
    { id: 'scaffolding', label: 'Project Creation', description: 'Initializing project files and configuration' },
    { id: 'assets', label: 'Asset Generation', description: 'Creating models, textures, and audio assets' },
    { id: 'gameplay', label: 'Gameplay Implementation', description: 'Building core game mechanics and interactions' },
    { id: 'testing', label: 'Testing', description: 'Verifying functionality and fixing issues' },
    { id: 'optimization', label: 'Optimization', description: 'Performance tuning and polish' },
    { id: 'complete', label: 'Complete', description: 'Final verification and handoff' },
  ],
  'bug-fix': [
    { id: 'diagnosis', label: 'Diagnosis', description: 'Identifying root cause of the issue' },
    { id: 'fix', label: 'Fix Implementation', description: 'Applying the correction' },
    { id: 'verification', label: 'Verification', description: 'Confirming the fix resolves the issue' },
    { id: 'regression-check', label: 'Regression Check', description: 'Ensuring no new issues introduced' },
    { id: 'complete', label: 'Complete', description: 'Fix finalized' },
  ],
  'performance': [
    { id: 'profiling', label: 'Profiling', description: 'Measuring current performance metrics' },
    { id: 'analysis', label: 'Bottleneck Analysis', description: 'Identifying optimization targets' },
    { id: 'optimization', label: 'Optimization', description: 'Implementing performance improvements' },
    { id: 'benchmarking', label: 'Benchmarking', description: 'Measuring improvement against baseline' },
    { id: 'complete', label: 'Complete', description: 'Optimization finalized' },
  ],
  'refactor': [
    { id: 'analysis', label: 'Code Analysis', description: 'Reviewing current code structure and patterns' },
    { id: 'planning', label: 'Refactor Planning', description: 'Designing improved architecture' },
    { id: 'migration', label: 'Migration', description: 'Restructuring code incrementally' },
    { id: 'verification', label: 'Verification', description: 'Testing refactored code' },
    { id: 'cleanup', label: 'Cleanup', description: 'Removing dead code and final polish' },
    { id: 'complete', label: 'Complete', description: 'Refactor finalized' },
  ],
  'analysis': [
    { id: 'scanning', label: 'Scanning', description: 'Reading project structure and files' },
    { id: 'analysis', label: 'Analysis', description: 'Processing and evaluating information' },
    { id: 'report', label: 'Report Generation', description: 'Compiling findings into a report' },
    { id: 'complete', label: 'Complete', description: 'Analysis complete' },
  ],
  'feature': [
    { id: 'planning', label: 'Planning', description: 'Understanding requirements and designing the solution' },
    { id: 'implementation', label: 'Implementation', description: 'Building the new feature' },
    { id: 'integration', label: 'Integration', description: 'Connecting feature with existing systems' },
    { id: 'testing', label: 'Testing', description: 'Verifying feature functionality and edge cases' },
    { id: 'complete', label: 'Complete', description: 'Feature finalized' },
  ],
  'unknown': [
    { id: 'analysis', label: 'Analysis', description: 'Analyzing the request' },
    { id: 'planning', label: 'Planning', description: 'Creating an execution plan' },
    { id: 'execution', label: 'Execution', description: 'Carrying out the planned work' },
    { id: 'verification', label: 'Verification', description: 'Verifying the results' },
    { id: 'complete', label: 'Complete', description: 'Mission complete' },
  ],
};

const CRITERIA_TEMPLATES: Record<GoalCategory, readonly string[]> = {
  'create-project': ['Project builds successfully', 'All assets load correctly', 'Core gameplay loop is functional', 'No errors'],
  'bug-fix': ['Bug is no longer reproducible', 'No regressions in related functionality', 'Build passes with zero errors'],
  'performance': ['Performance metrics show measurable improvement', 'No regressions in visual quality', 'Target performance goal achieved'],
  'refactor': ['Existing functionality is preserved', 'Code follows project style guide', 'Build passes with zero errors'],
  'analysis': ['Findings are documented', 'Actionable recommendations provided'],
  'feature': ['Feature works as specified', 'Edge cases are handled', 'Tests pass'],
  'unknown': ['Request is understood and processed', 'No errors encountered', 'Results are documented'],
};

function generateMissionId(): string {
  return `mission-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function classifyGoal(text: string): GoalCategory {
  const matched = GOAL_RULES
    .filter((rule) => rule.patterns.some((p) => p.test(text)))
    .sort((a, b) => b.priority - a.priority);
  return matched[0]?.category ?? 'unknown';
}

function detectProjectType(text: string, goal: GoalCategory): string {
  if (/game/i.test(text)) {
    if (/racing/i.test(text)) return 'Racing Game';
    if (/rpg|role.*playing/i.test(text)) return 'RPG';
    if (/platformer|platform/i.test(text)) return 'Platformer';
    if (/fps|shooter/i.test(text)) return 'FPS';
    if (/strategy/i.test(text)) return 'Strategy Game';
    if (/puzzle/i.test(text)) return 'Puzzle Game';
    if (/horror/i.test(text)) return 'Horror Game';
    return 'Game Project';
  }
  if (/web\s*(app|site|application)/i.test(text)) return 'Web Application';
  if (/mobile/i.test(text)) return 'Mobile App';
  if (/3d.*scene|scene.*3d/i.test(text)) return '3D Scene';
  if (/tool|utility/i.test(text)) return 'Tool';
  if (/api|server|backend/i.test(text)) return 'Backend Service';
  return goal === 'create-project' ? 'Project' : 'Task';
}

function generateSummary(text: string, goal: GoalCategory, technologies: readonly Technology[], projectType: string): string {
  const techNames = technologies.map((t) => t.name);
  const techStr = techNames.length > 0 ? ` using ${techNames.slice(0, 3).join(', ')}` : '';

  switch (goal) {
    case 'create-project':
      return `Create a new ${projectType}${techStr}`;
    case 'bug-fix':
      return text.length > 80 ? text.slice(0, 77) + '...' : text;
    case 'performance':
      return text.length > 80 ? text.slice(0, 77) + '...' : text;
    case 'refactor':
      return text.length > 80 ? text.slice(0, 77) + '...' : text;
    case 'analysis':
      return text.length > 80 ? text.slice(0, 77) + '...' : text;
    case 'feature':
      return text.length > 80 ? text.slice(0, 77) + '...' : text;
    default:
      return text.length > 80 ? text.slice(0, 77) + '...' : text;
  }
}

function detectTechnologies(text: string): Technology[] {
  const detected: Technology[] = [];
  for (const rule of TECH_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      detected.push({ name: rule.name, inferred: false });
    }
  }
  return detected;
}

function inferTechnologies(text: string): Technology[] {
  const inferred: Technology[] = [];
  for (const rule of INFERENCE_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      for (const techName of rule.technologies) {
        if (!inferred.some((t) => t.name === techName)) {
          inferred.push({ name: techName, inferred: true });
        }
      }
    }
  }
  return inferred;
}

function mergeTechnologies(detected: readonly Technology[], inferred: readonly Technology[]): Technology[] {
  const merged = [...detected];
  for (const inf of inferred) {
    if (!merged.some((t) => t.name === inf.name)) {
      merged.push(inf);
    }
  }
  return merged;
}

function estimateComplexity(text: string, goal: GoalCategory, technologies: readonly Technology[]): Complexity {
  if (/large|complex|full\s*(game|app)|extensive|enterprise/i.test(text)) return 'high';
  if (/simple|small|basic|quick|minor/i.test(text)) return 'low';
  if (technologies.length >= 3) return 'high';
  if (goal === 'create-project') return 'medium';
  if (goal === 'bug-fix') return 'low';
  if (goal === 'performance') return 'medium';
  if (goal === 'refactor' && /large/i.test(text)) return 'high';
  if (goal === 'analysis') return 'low';
  return 'medium';
}

function determineRequiredAbilities(text: string, goal: GoalCategory, technologies: readonly Technology[]): MissionAbility[] {
  const abilities: MissionAbility[] = [
    'read-files',
    'write-files',
    'list-files',
    'run-commands',
    'inspect-workspace',
  ];

  const techNames = technologies.map((t) => t.name);

  // Version control needed for all missions
  abilities.push('version-control-status', 'version-control-commit');

  if (goal === 'create-project' || goal === 'feature') {
    abilities.push('version-control-init');
    abilities.push('edit-code');
    abilities.push('open-editor');
  }

  if (goal === 'bug-fix') {
    abilities.push('edit-code');
    abilities.push('search-text');
  }

  if (goal === 'refactor') {
    abilities.push('edit-code');
    abilities.push('search-text');
    abilities.push('rename-files');
    abilities.push('delete-files');
  }

  if (goal === 'analysis') {
    abilities.push('search-text', 'search-files');
  }

  if (goal === 'performance') {
    abilities.push('search-text', 'search-files');
    abilities.push('build-project');
    abilities.push('run-terminal');
  }

  if (goal === 'create-project' || /browser|preview|web/i.test(text)) {
    abilities.push('preview-project');
  }

  if (goal === 'create-project') {
    abilities.push('install-packages');
    abilities.push('build-project');
  }

  if (techNames.includes('Blender')) {
    abilities.push('3d-model');
    abilities.push('render-scene');
  }

  if (techNames.some((t) => ['React', 'Vite', 'TypeScript', 'Node.js'].includes(t))) {
    abilities.push('install-packages');
    abilities.push('build-project');
  }

  return abilities;
}

function generateStages(goal: GoalCategory): ExecutionStage[] {
  const template = STAGE_TEMPLATES[goal];
  return template.map((s) => ({ ...s }));
}

function detectRisks(text: string, goal: GoalCategory): Risk[] {
  const risks: Risk[] = [];

  if (goal === 'create-project') {
    risks.push({ severity: 'low', description: 'Project may need additional dependencies or initialization' });
  }

  if (/refactor|rewrite|restructure/i.test(text)) {
    risks.push({ severity: 'high', description: 'Refactoring may break existing functionality' });
  }

  if (/large|complex|extensive/i.test(text)) {
    risks.push({ severity: 'medium', description: 'Scope may be underestimated' });
  }

  if (/ai|llm|neural|machine\s*learning/i.test(text)) {
    risks.push({ severity: 'medium', description: 'External API dependency may be required' });
  }

  if (goal === 'bug-fix' && /random|intermittent|sometimes/i.test(text)) {
    risks.push({ severity: 'high', description: 'Intermittent issues are difficult to reproduce and diagnose' });
  }

  if (goal === 'performance') {
    risks.push({ severity: 'medium', description: 'Performance improvements may require trade-offs in other areas' });
  }

  if (/blender|asset|model|texture/i.test(text) && !text.includes('Blender')) {
    risks.push({ severity: 'low', description: 'Asset generation may require manual review or external tools' });
  }

  if (risks.length === 0) {
    risks.push({ severity: 'low', description: 'No significant risks detected' });
  }

  return risks;
}

function recordAssumptions(text: string, goal: GoalCategory, technologies: readonly Technology[]): string[] {
  const assumptions: string[] = [];

  if (technologies.length === 0) {
    assumptions.push('No specific technologies detected; using default toolchain');
  }

  if (goal === 'create-project' && technologies.every((t) => !t.inferred)) {
    assumptions.push('No engine specified; assuming web-based project with standard tooling');
  }

  if (goal === 'bug-fix' && !/project|repo|codebase/i.test(text)) {
    assumptions.push('Bug exists within the current project scope');
  }

  assumptions.push('Execution environment has necessary permissions and tools installed');
  assumptions.push('Mission will run against the current workspace');

  return assumptions;
}

function deriveToolsFromAbilities(abilities: readonly MissionAbility[]): ToolDefinition[] {
  const toolMap = new Map<string, ToolDefinition>();

  const addIf = (id: string, name: string, category: string, condition: boolean): void => {
    if (condition && !toolMap.has(id)) {
      toolMap.set(id, { id, name, category, required: true });
    }
  };

  addIf('vscode', 'VS Code', 'editor', true);
  addIf('terminal', 'Terminal', 'system', true);
  addIf('git', 'Git', 'vcs', true);

  addIf('browser', 'Browser', 'preview',
    abilities.includes('browse-web') || abilities.includes('preview-project'));
  addIf('blender', 'Blender', 'asset',
    abilities.includes('3d-model') || abilities.includes('render-scene'));
  addIf('node', 'Node.js', 'runtime',
    abilities.includes('install-packages') || abilities.includes('build-project'));

  return [...toolMap.values()];
}

function defineCriteria(goal: GoalCategory): string[] {
  return [...CRITERIA_TEMPLATES[goal]];
}

export class MissionPlanner {
  plan(text: string): MissionPlan {
    const goal = classifyGoal(text);
    const projectType = detectProjectType(text, goal);
    const technologies = detectTechnologies(text);
    const inferredTechs = inferTechnologies(text);
    const mergedTechs = mergeTechnologies(technologies, inferredTechs);
    const summary = generateSummary(text, goal, mergedTechs, projectType);
    const complexity = estimateComplexity(text, goal, mergedTechs);
    const abilities = determineRequiredAbilities(text, goal, mergedTechs);
    const stages = generateStages(goal);
    const risks = detectRisks(text, goal);
    const assumptions = recordAssumptions(text, goal, mergedTechs);
    const criteria = defineCriteria(goal);

    // Derive tool-level requirements from abilities for backward compatibility
    const tools = deriveToolsFromAbilities(abilities);

    return {
      missionId: generateMissionId(),
      goal,
      summary,
      projectType,
      detectedTechnologies: mergedTechs,
      estimatedComplexity: complexity,
      requiredAbilities: abilities,
      requiredTools: tools,
      executionStages: stages,
      risks,
      assumptions,
      successCriteria: criteria,
    };
  }
}
