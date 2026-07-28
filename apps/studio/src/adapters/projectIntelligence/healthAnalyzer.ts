import type { FileIndex, HealthReport, HealthIssue } from './types';

const LINE_THRESHOLD = 500;
const HIDDEN_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'build']);

export function analyzeHealth(files: FileIndex): HealthReport {
  const issues: HealthIssue[] = [];
  const oversizedFiles: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  let totalFiles = 0;
  let totalDirs = 0;
  const dirSet = new Set<string>();

  for (const filePath of Object.keys(files)) {
    const normalized = filePath.replace(/\\/g, '/');
    const parts = normalized.split('/');

    let isHidden = false;
    for (const part of parts) {
      if (HIDDEN_DIRS.has(part)) { isHidden = true; break; }
      if (part) dirSet.add(part);
    }
    if (isHidden) continue;

    totalFiles++;

    const content = files[filePath];
    if (content) {
      const lines = content.split('\n').length;
      if (lines > LINE_THRESHOLD) {
        oversizedFiles.push(normalized);
        if (oversizedFiles.length <= 5) {
          issues.push({
            severity: 'warning',
            category: 'file-size',
            message: `File exceeds ${LINE_THRESHOLD} lines (${lines} lines)`,
            location: normalized,
            suggestion: 'Consider splitting into smaller modules',
          });
        }
      }
    }
  }

  totalDirs = dirSet.size;

  const hasTsConfig = Object.keys(files).some((f) => f.includes('tsconfig.json'));
  const hasPackageJson = Object.keys(files).some((f) => f.endsWith('package.json'));
  const hasReadme = Object.keys(files).some((f) => f.toLowerCase().includes('readme.md'));
  const hasLicense = Object.keys(files).some((f) => f.toLowerCase().includes('license'));
  const hasGitignore = Object.keys(files).some((f) => f.includes('.gitignore'));
  const hasIndexHtml = Object.keys(files).some((f) => f.endsWith('index.html'));

  const hasSourceFiles = Object.keys(files).some((f) => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js'));

  if (!hasPackageJson) {
    issues.push({
      severity: 'error',
      category: 'config',
      message: 'package.json not found',
      suggestion: 'Create a package.json to manage dependencies',
    });
  }

  if (hasSourceFiles && !hasTsConfig) {
    issues.push({
      severity: 'warning',
      category: 'config',
      message: 'TypeScript detected but tsconfig.json not found',
      suggestion: 'Consider adding TypeScript configuration',
    });
  }

  if (!hasReadme) {
    warnings.push('No README.md found');
    recommendations.push('Add a README.md for project documentation');
  }

  if (!hasLicense) {
    warnings.push('No LICENSE file found');
  }

  if (!hasGitignore) {
    warnings.push('No .gitignore found');
  }

  if (!hasIndexHtml && hasSourceFiles) {
    warnings.push('No index.html found for web project');
  }

  const totalIssues = issues.length;
  const issueWeight = Math.min(totalIssues * 8, 60);
  const healthScore = Math.max(10, 100 - issueWeight - (oversizedFiles.length > 5 ? 10 : 0));

  return {
    score: healthScore,
    totalFiles,
    totalDirs,
    oversizedFiles,
    issues,
    warnings,
    recommendations,
  };
}

export function scanDirectory(paths: string[]): { totalFiles: number; totalDirs: number; configFiles: string[]; packageManagers: string[]; buildSystems: string[] } {
  const configFiles: string[] = [];
  const packageManagers: string[] = [];
  const buildSystems: string[] = [];

  for (const filePath of paths) {
    const name = filePath.split('/').pop() ?? filePath.split('\\').pop() ?? filePath;

    if (name === 'package.json') {
      packageManagers.push('npm');
      if (!buildSystems.includes('npm')) buildSystems.push('npm');
    }
    if (name === 'pnpm-lock.yaml') {
      if (!packageManagers.includes('pnpm')) packageManagers.push('pnpm');
    }
    if (name === 'yarn.lock') {
      if (!packageManagers.includes('yarn')) packageManagers.push('yarn');
    }
    if (name === 'Cargo.toml') {
      packageManagers.push('cargo');
      buildSystems.push('cargo');
    }
    if (name?.startsWith('vite.config')) {
      configFiles.push(name);
      if (!buildSystems.includes('vite')) buildSystems.push('vite');
    }
    if (name === 'tsconfig.json') configFiles.push(name);
    if (name === 'biome.json' || name === '.biome.jsonc') configFiles.push(name);
    if (name === '.gitignore') configFiles.push(name);
    if (name === 'Dockerfile') configFiles.push(name);
    if (name?.startsWith('.env')) configFiles.push(name);
  }

  return {
    totalFiles: paths.length,
    totalDirs: new Set(paths.map((p) => p.substring(0, p.lastIndexOf('/'))).filter(Boolean)).size,
    configFiles,
    packageManagers: [...new Set(packageManagers)],
    buildSystems: [...new Set(buildSystems)],
  };
}
