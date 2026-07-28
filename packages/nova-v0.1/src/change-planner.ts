import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { IntentAnalysis, LocatedFile, DependencyMap, ChangePlan, Change, TextEdit, ImpactEstimate } from './change-types';
import type { ProjectContext } from './types';

function backupStrategy(filePath: string, projectDir: string): Change['rollback'] {
  const gitDir = join(projectDir, '.git');
  if (existsSync(gitDir)) {
    return { type: 'git' };
  }
  return { type: 'backup', backupPath: join('.nova', 'backups', filePath.replace(/[\\/]/g, '_') + '.bak') };
}

function editForOrbitControls(targetFile: string, context: ProjectContext): Change {
  const edits: TextEdit[] = [];
  const fileObj = context.source.files.find((f) => f.path === targetFile);

  const hasControlsImport = fileObj?.imports.some(
    (imp) => imp.includes('OrbitControls') || imp.includes('controls/OrbitControls'),
  ) ?? false;

  if (!hasControlsImport) {
    edits.push({
      file: targetFile,
      operation: 'insert-after',
      anchor: 'import ',
      text: `import { OrbitControls } from 'three/addons/controls/OrbitControls.js';`,
      reason: 'Import OrbitControls for camera interaction',
    });
  }

  edits.push({
    file: targetFile,
    operation: 'insert-after',
    anchor: 'renderer.domElement',
    text: `const controls = new OrbitControls(camera, renderer.domElement);`,
    reason: 'Create OrbitControls instance linked to camera and renderer',
  });

  return {
    file: targetFile,
    operation: 'edit',
    edits,
    reason: `Add OrbitControls for ${targetFile}`,
    rollback: { type: 'none' },
  };
}

function planForModify(intent: IntentAnalysis, located: ReadonlyArray<LocatedFile>, context: ProjectContext): ChangePlan {
  const changes: Change[] = [];
  const lower = intent.description.toLowerCase();

  let target = '';
  if (located.length > 0) {
    target = located[0]!.path;
  } else if (context.source.entryPoints.length > 0) {
    target = context.source.entryPoints[0]!;
  } else if (context.source.files.length > 0) {
    target = context.source.files[0]!.path;
  }
  if (!target) {
    return {
      request: intent.description,
      intent,
      changes: [],
      impact: { filesDirectlyAffected: 0, filesTransitivelyAffected: 0, externalDependenciesChanged: [], riskLevel: 'low' },
    };
  }

  if (lower.includes('orbit') && lower.includes('control')) {
    changes.push(editForOrbitControls(target, context));
  } else {
    changes.push({
      file: target,
      operation: 'edit',
      edits: [{
        file: target,
        operation: 'insert-after',
        anchor: '',
        text: `// Nova modification: ${intent.description}`,
        reason: intent.description,
      }],
      reason: intent.description,
      rollback: { type: 'none' },
    });
  }

  return {
    request: intent.description,
    intent,
    changes,
    impact: { filesDirectlyAffected: changes.length, filesTransitivelyAffected: 0, externalDependenciesChanged: [], riskLevel: 'low' },
  };
}

function planForExplain(_intent: IntentAnalysis): ChangePlan {
  return {
    request: _intent.description,
    intent: _intent,
    changes: [],
    impact: { filesDirectlyAffected: 0, filesTransitivelyAffected: 0, externalDependenciesChanged: [], riskLevel: 'low' },
  };
}

export function planChanges(
  intent: IntentAnalysis,
  located: ReadonlyArray<LocatedFile>,
  _deps: DependencyMap,
  _impact: ImpactEstimate,
  context: ProjectContext,
): ChangePlan {
  let plan: ChangePlan;

  switch (intent.intent) {
    case 'explain':
    case 'debug':
      plan = planForExplain(intent);
      break;
    case 'modify':
    case 'refactor':
    case 'optimize':
    case 'create':
    case 'delete':
    default:
      plan = planForModify(intent, located, context);
      break;
  }

  const resolvedChanges = plan.changes.map((c) => ({
    ...c,
    rollback: c.rollback.type === 'none' ? backupStrategy(c.file, context.projectPath) : c.rollback,
  }));

  return { ...plan, changes: resolvedChanges, impact: _impact };
}

export function formatPlan(plan: ChangePlan): string {
  const lines: string[] = [];
  lines.push(`Change Plan: ${plan.intent.intent}`);
  lines.push(`  Request: ${plan.request}`);
  lines.push(`  Target: ${plan.intent.targets.join(', ') || 'auto-detected'}`);
  lines.push(`  Risk: ${plan.impact.riskLevel}`);
  lines.push(`  Files: ${plan.impact.filesDirectlyAffected} direct, ${plan.impact.filesTransitivelyAffected} transitive`);
  lines.push('');
  for (const change of plan.changes) {
    lines.push(`  ${change.operation} ${change.file}`);
    lines.push(`    Reason: ${change.reason}`);
    for (const edit of change.edits) {
      lines.push(`    ${edit.operation} "${edit.anchor}"`);
    }
    lines.push(`    Rollback: ${change.rollback.type}`);
  }
  return lines.join('\n');
}
