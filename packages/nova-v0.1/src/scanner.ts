import { scanRepo } from './repo-scanner';
import { scanSource } from './source-scanner';
import { scanAssets } from './asset-scanner';
import { analyzeArchitecture } from './arch-analyzer';
import type { ProjectContext } from './types';

export async function scanProject(projectPath: string): Promise<ProjectContext> {
  const repo = scanRepo(projectPath);
  const source = scanSource(projectPath);
  const assets = scanAssets(projectPath);
  const architecture = analyzeArchitecture(source.files, projectPath);

  return {
    projectPath,
    repo,
    source,
    assets,
    architecture,
    scannedAt: new Date().toISOString(),
  };
}

export function formatContextSummary(ctx: ProjectContext): string {
  const lines: string[] = [];
  lines.push(`Project: ${ctx.projectPath}`);
  lines.push(`Scanned: ${ctx.scannedAt}`);
  lines.push('');

  if (ctx.repo.framework) lines.push(`Framework: ${ctx.repo.framework}`);
  if (ctx.repo.language) lines.push(`Language: ${ctx.repo.language}`);
  if (ctx.repo.buildSystem) lines.push(`Build: ${ctx.repo.buildSystem}`);
  if (ctx.repo.packageManager) lines.push(`Package Manager: ${ctx.repo.packageManager}`);
  if (ctx.repo.isGitRepo) lines.push(`Git: ${ctx.repo.gitBranch ?? 'yes'}`);
  lines.push('');

  lines.push(`Source files: ${ctx.source.fileCount}`);
  if (ctx.source.entryPoints.length > 0) {
    lines.push(`Entry points: ${ctx.source.entryPoints.join(', ')}`);
  }
  if (ctx.source.systems.length > 0) {
    for (const sys of ctx.source.systems) {
      lines.push(`  ${sys.name}: ${sys.files.length} file(s)`);
    }
  }
  lines.push('');

  const assetCount =
    ctx.assets.models.length +
    ctx.assets.textures.length +
    ctx.assets.materials.length +
    ctx.assets.shaders.length +
    ctx.assets.audio.length +
    ctx.assets.animations.length;

  if (assetCount > 0) {
    lines.push(`Assets: ${assetCount} total`);
    if (ctx.assets.models.length > 0) lines.push(`  Models: ${ctx.assets.models.length}`);
    if (ctx.assets.textures.length > 0) lines.push(`  Textures: ${ctx.assets.textures.length}`);
    if (ctx.assets.shaders.length > 0) lines.push(`  Shaders: ${ctx.assets.shaders.length}`);
    if (ctx.assets.audio.length > 0) lines.push(`  Audio: ${ctx.assets.audio.length}`);
    if (ctx.assets.animations.length > 0) lines.push(`  Animations: ${ctx.assets.animations.length}`);
  }

  if (ctx.assets.missingReferences.length > 0) {
    lines.push(`Missing references: ${ctx.assets.missingReferences.length}`);
  }
  lines.push('');

  lines.push(`Architecture: ${ctx.architecture.pattern}`);
  if (ctx.architecture.managers.length > 0) lines.push(`  Managers: ${ctx.architecture.managers.length}`);
  if (ctx.architecture.services.length > 0) lines.push(`  Services: ${ctx.architecture.services.length}`);
  if (ctx.architecture.controllers.length > 0) lines.push(`  Controllers: ${ctx.architecture.controllers.length}`);
  if (ctx.architecture.components.length > 0) lines.push(`  Components: ${ctx.architecture.components.length}`);
  if (ctx.architecture.systems.length > 0) lines.push(`  Systems: ${ctx.architecture.systems.length}`);

  return lines.join('\n');
}
