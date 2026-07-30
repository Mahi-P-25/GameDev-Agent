import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_DIR = join(__dirname, '..', 'create-a-three-js-vite-project-named-apex');
const DIST_DIR = join(__dirname, '..', 'dist');
const BENCH_BACKUP = join(__dirname, '..', '.nova', 'bench-backups');

interface BenchmarkCase {
  name: string;
  description: string;
  breakIt: () => void;
}

function backup(): void {
  const src = join(PROJECT_DIR, 'src', 'main.ts');
  if (!existsSync(BENCH_BACKUP)) mkdirSync(BENCH_BACKUP, { recursive: true });
  copyFileSync(src, join(BENCH_BACKUP, 'main.ts.original'));

  const pkg = join(PROJECT_DIR, 'package.json');
  copyFileSync(pkg, join(BENCH_BACKUP, 'package.json.original'));

  const vite = join(PROJECT_DIR, 'vite.config.ts');
  if (existsSync(vite)) copyFileSync(vite, join(BENCH_BACKUP, 'vite.config.ts.original'));
}

function restore(): void {
  const src = join(BENCH_BACKUP, 'main.ts.original');
  if (existsSync(src)) copyFileSync(src, join(PROJECT_DIR, 'src', 'main.ts'));

  const pkg = join(BENCH_BACKUP, 'package.json.original');
  if (existsSync(pkg)) copyFileSync(pkg, join(PROJECT_DIR, 'package.json'));

  const vite = join(BENCH_BACKUP, 'vite.config.ts.original');
  if (existsSync(vite)) copyFileSync(vite, join(PROJECT_DIR, 'vite.config.ts'));

  // Reinstall dependencies to ensure they match package.json
  try {
    execSync('npm install', { cwd: PROJECT_DIR, encoding: 'utf-8', timeout: 120_000, windowsHide: true, shell: true });
  } catch { /* expected to fail sometimes */ }
}

function readMain(): string {
  return readFileSync(join(PROJECT_DIR, 'src', 'main.ts'), 'utf-8');
}

function writeMain(content: string): void {
  writeFileSync(join(PROJECT_DIR, 'src', 'main.ts'), content, 'utf-8');
}

function readPkg(): string {
  return readFileSync(join(PROJECT_DIR, 'package.json'), 'utf-8');
}

function writePkg(content: string): void {
  writeFileSync(join(PROJECT_DIR, 'package.json'), content, 'utf-8');
}

function readVite(): string {
  return readFileSync(join(PROJECT_DIR, 'vite.config.ts'), 'utf-8');
}

function writeVite(content: string): void {
  writeFileSync(join(PROJECT_DIR, 'vite.config.ts'), content, 'utf-8');
}

function runFix(): boolean {
  try {
    const distIndex = join(DIST_DIR, 'index.js');
    const result = execSync(`node "${distIndex}" fix --project-dir "${PROJECT_DIR}"`, {
      cwd: __dirname,
      encoding: 'utf-8',
      timeout: 180_000,
      windowsHide: true,
      shell: true,
    });
    const lines = result.split('\n');
    for (const line of lines) {
      if (line.includes('Build: PASS') || line.includes('Status: completed')) {
        return true;
      }
    }
    return false;
  } catch (e) {
    const output = String((e as { stdout?: string; stderr?: string }).stdout ?? (e as { stderr?: string }).stderr ?? '');
    return output.includes('Build: PASS') || output.includes('Status: completed');
  }
}

function checkBuild(): boolean {
  try {
    execSync('npm run build', {
      cwd: PROJECT_DIR,
      encoding: 'utf-8',
      timeout: 120_000,
      windowsHide: true,
      shell: true,
    });
    return true;
  } catch {
    return false;
  }
}

const benchmarks: BenchmarkCase[] = [
  {
    name: 'remove-import',
    description: 'Remove the THREE import statement',
    breakIt: () => {
      const content = readMain();
      writeMain(content.replace(/import\s+\*\s+as\s+THREE\s+from\s+["']three["'];\n?/, ''));
    },
  },
  {
    name: 'misspell-three-mesh',
    description: 'Misspell THREE.Mesh as THREE.Meshh',
    breakIt: () => {
      const content = readMain();
      writeMain(content.replace(/THREE\.Mesh\b/g, 'THREE.Meshh'));
    },
  },
  {
    name: 'unused-variable',
    description: 'Add an unused variable declaration',
    breakIt: () => {
      const content = readMain();
      writeMain(content.replace(
        /(renderer\.render\(scene, camera\);\s*\n\s*})/,
        'const unusedVar = "test";\n$1',
      ));
    },
  },
  {
    name: 'missing-semicolon',
    description: 'Break line with syntax error (missing paren)',
    breakIt: () => {
      const content = readMain();
      writeMain(content.replace('new THREE.BoxGeometry()', 'new THREE.BoxGeometry('));
    },
  },
  {
    name: 'broken-path',
    description: 'Break an import path',
    breakIt: () => {
      const content = readMain();
      writeMain(content.replace(/from "three"/, 'from "./nonexistent/module"'));
    },
  },
  {
    name: 'duplicate-declaration',
    description: 'Add a duplicate variable declaration',
    breakIt: () => {
      const content = readMain();
      writeMain(content.replace(/(const scene =)/, 'const scene = 1;\nconst x = 1;\nconst x = 2;\n$1'));
    },
  },
  {
    name: 'broken-vite-config',
    description: 'Introduce a syntax error in vite.config.ts',
    breakIt: () => {
      const content = readVite();
      writeVite(content.replace('})', ')'));
    },
  },
  {
    name: 'missing-dependency',
    description: 'Remove three from dependencies',
    breakIt: () => {
      const pkg = JSON.parse(readPkg());
      delete pkg.dependencies.three;
      delete pkg.devDependencies['@types/three'];
      writePkg(JSON.stringify(pkg, null, 2));
      // Also need to reinstall to reflect the change
      try {
        execSync('npm install', { cwd: PROJECT_DIR, encoding: 'utf-8', timeout: 120_000, windowsHide: true, shell: true });
      } catch { /* expected to fail */ }
    },
  },
];

async function runBenchmarks(): Promise<void> {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     Nova Debug Benchmark Suite           ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  backup();

  const results: Array<{ name: string; passed: boolean; notes: string }> = [];

  for (const bench of benchmarks) {
    console.log(`\n─── ${bench.name}: ${bench.description} ───`);

    // Ensure project is clean
    restore();

    // Verify clean build
    if (!checkBuild()) {
      console.log('  SKIP: Clean project does not build!');
      results.push({ name: bench.name, passed: false, notes: 'Clean project failed to build' });
      continue;
    }

    // Break it
    bench.breakIt();

    // Verify broken
    if (checkBuild()) {
      console.log('  SKIP: Breaking did not cause build failure');
      results.push({ name: bench.name, passed: false, notes: 'Breaking had no effect' });
      continue;
    }
    console.log('  ✓ Build broken by mutation');

    // Run Nova fix
    console.log('  Running nova fix...');
    const fixed = runFix();

    // Check result
    const buildPasses = checkBuild();
    const status = buildPasses ? '✓ PASS' : '✗ FAIL';
    console.log(`  ${status}: Build after fix: ${buildPasses ? 'PASSES' : 'FAILS'}`);

    // If fix failed, check what the file looks like
    if (!buildPasses) {
      const content = readMain();
      console.log(`  Current file (first 3 lines): ${content.split('\n').slice(0, 3).join(' | ')}`);
    }

    results.push({
      name: bench.name,
      passed: buildPasses,
      notes: fixed ? 'Fix applied' : 'Fix not applied',
    });
  }

  // Restore project
  restore();

  // Summary
  console.log('\n');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║           Benchmark Results               ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  for (const r of results) {
    console.log(`  ${r.passed ? '✓' : '✗'} ${r.name}: ${r.passed ? 'PASS' : 'FAIL'} — ${r.notes}`);
  }
  console.log('');
  console.log(`  Score: ${passed}/${total} (${((passed / total) * 100).toFixed(0)}%)`);

  process.exit(passed === total ? 0 : 1);
}

runBenchmarks().catch((e) => {
  console.error('Benchmark error:', e);
  restore();
  process.exit(1);
});
