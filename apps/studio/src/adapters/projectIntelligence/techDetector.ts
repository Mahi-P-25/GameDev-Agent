import type { FileIndex, DetectedTechnology, TechSignature } from './types';

const TECH_SIGNATURES: TechSignature[] = [
  {
    name: 'TypeScript',
    category: 'language',
    detect: (files: FileIndex) => {
      const tsFiles = Object.keys(files).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
      const hasTsConfig = Object.keys(files).some((f) => f.includes('tsconfig'));
      return {
        detected: tsFiles.length > 0,
        confidence: hasTsConfig ? 1 : tsFiles.length > 0 ? 0.8 : 0,
        evidence: hasTsConfig ? ['tsconfig.json found'] : [`${tsFiles.length} .ts files found`],
      };
    },
  },
  {
    name: 'React',
    category: 'framework',
    detect: (files: FileIndex) => {
      const hasReactImport = Object.values(files).some((c) => /from\s+['"]react['"]/.test(c) || /require\(['"]react['"]\)/.test(c));
      const hasPkgJson = Object.keys(files).some((f) => f.endsWith('package.json'));
      let pkgReact = false;
      if (hasPkgJson) {
        const pkgFile = Object.entries(files).find(([f]) => f.endsWith('package.json'));
        if (pkgFile) {
          try {
            const pkg = JSON.parse(pkgFile[1]);
            pkgReact = !!(pkg.dependencies?.react || pkg.devDependencies?.react);
          } catch { /* ignore parse errors */ }
        }
      }
      return {
        detected: hasReactImport || pkgReact,
        confidence: pkgReact ? 0.95 : hasReactImport ? 0.8 : 0,
        evidence: pkgReact ? ['react in package.json'] : hasReactImport ? ['React import found in source files'] : [],
      };
    },
  },
  {
    name: 'Three.js',
    category: 'engine',
    detect: (files: FileIndex) => {
      const hasImport = Object.values(files).some((c) => /from\s+['"]three['"]/.test(c) || /require\(['"]three['"]\)/.test(c));
      const hasPkgJson = Object.keys(files).some((f) => f.endsWith('package.json'));
      let pkgThree = false;
      if (hasPkgJson) {
        const pkgFile = Object.entries(files).find(([f]) => f.endsWith('package.json'));
        if (pkgFile) {
          try {
            const pkg = JSON.parse(pkgFile[1]);
            pkgThree = !!(pkg.dependencies?.three || pkg.devDependencies?.three);
          } catch { /* ignore */ }
        }
      }
      const glslFiles = Object.keys(files).filter((f) => f.endsWith('.glsl') || f.endsWith('.frag') || f.endsWith('.vert'));
      return {
        detected: hasImport || pkgThree || glslFiles.length > 0,
        confidence: pkgThree ? 0.95 : hasImport ? 0.85 : glslFiles.length > 0 ? 0.6 : 0,
        evidence: pkgThree ? ['three in package.json'] : hasImport ? ['Three.js import found'] : glslFiles.length > 0 ? [`${glslFiles.length} GLSL shader files found`] : [],
      };
    },
  },
  {
    name: 'Vite',
    category: 'tool',
    detect: (files: FileIndex) => {
      const hasViteConfig = Object.keys(files).some((f) => f.includes('vite.config'));
      const hasPkgJson = Object.keys(files).some((f) => f.endsWith('package.json'));
      let pkgVite = false;
      if (hasPkgJson) {
        const pkgFile = Object.entries(files).find(([f]) => f.endsWith('package.json'));
        if (pkgFile) {
          try {
            const pkg = JSON.parse(pkgFile[1]);
            pkgVite = !!(pkg.devDependencies?.vite);
          } catch { /* ignore */ }
        }
      }
      return {
        detected: hasViteConfig || pkgVite,
        confidence: hasViteConfig ? 1 : pkgVite ? 0.8 : 0,
        evidence: hasViteConfig ? ['vite.config found'] : pkgVite ? ['vite in devDependencies'] : [],
      };
    },
  },
  {
    name: 'Tailwind CSS',
    category: 'framework',
    detect: (files: FileIndex) => {
      const hasConfig = Object.keys(files).some((f) => f.includes('tailwind'));
      const hasDirectives = Object.values(files).some((c) => c.includes('@tailwind') || c.includes('@apply'));
      const hasPkgJson = Object.keys(files).some((f) => f.endsWith('package.json'));
      let pkgTailwind = false;
      if (hasPkgJson) {
        const pkgFile = Object.entries(files).find(([f]) => f.endsWith('package.json'));
        if (pkgFile) {
          try {
            const pkg = JSON.parse(pkgFile[1]);
            pkgTailwind = !!(pkg.dependencies?.tailwindcss || pkg.devDependencies?.tailwindcss);
          } catch { /* ignore */ }
        }
      }
      return {
        detected: hasConfig || hasDirectives || pkgTailwind,
        confidence: hasConfig ? 1 : hasDirectives ? 0.9 : pkgTailwind ? 0.8 : 0,
        evidence: hasConfig ? ['tailwind config found'] : hasDirectives ? ['@tailwind directives found'] : pkgTailwind ? ['tailwindcss in dependencies'] : [],
      };
    },
  },
  {
    name: 'GLSL',
    category: 'language',
    detect: (files: FileIndex) => {
      const glslFiles = Object.keys(files).filter((f) => f.endsWith('.glsl') || f.endsWith('.frag') || f.endsWith('.vert'));
      const hasGlslContent = Object.values(files).some((c) => c.includes('#version') || c.includes('uniform') || c.includes('varying'));
      return {
        detected: glslFiles.length > 0 || hasGlslContent,
        confidence: glslFiles.length > 0 ? 1 : hasGlslContent ? 0.7 : 0,
        evidence: glslFiles.length > 0 ? [`${glslFiles.length} shader files`] : hasGlslContent ? ['GLSL syntax detected inline'] : [],
      };
    },
  },
  {
    name: 'Motion (Framer Motion)',
    category: 'framework',
    detect: (files: FileIndex) => {
      const hasImport = Object.values(files).some((c) => /from\s+['"]framer-motion['"]/.test(c) || /from\s+['"]motion(?:\/|['"])/.test(c));
      const hasPkgJson = Object.keys(files).some((f) => f.endsWith('package.json'));
      let pkgMotion = false;
      if (hasPkgJson) {
        const pkgFile = Object.entries(files).find(([f]) => f.endsWith('package.json'));
        if (pkgFile) {
          try {
            const pkg = JSON.parse(pkgFile[1]);
            pkgMotion = !!(pkg.dependencies?.['framer-motion'] || pkg.dependencies?.motion);
          } catch { /* ignore */ }
        }
      }
      return {
        detected: hasImport || pkgMotion,
        confidence: pkgMotion ? 0.95 : hasImport ? 0.85 : 0,
        evidence: pkgMotion ? ['motion in dependencies'] : hasImport ? ['motion import found'] : [],
      };
    },
  },
  {
    name: 'Radix UI',
    category: 'framework',
    detect: (files: FileIndex) => {
      const hasImport = Object.values(files).some((c) => /from\s+['"]@radix-ui\//.test(c));
      const hasPkgJson = Object.keys(files).some((f) => f.endsWith('package.json'));
      let pkgRadix = false;
      if (hasPkgJson) {
        const pkgFile = Object.entries(files).find(([f]) => f.endsWith('package.json'));
        if (pkgFile) {
          try {
            const pkg = JSON.parse(pkgFile[1]);
            pkgRadix = Object.keys(pkg.dependencies ?? {}).some((d) => d.startsWith('@radix-ui/'));
          } catch { /* ignore */ }
        }
      }
      return {
        detected: hasImport || pkgRadix,
        confidence: pkgRadix ? 0.95 : hasImport ? 0.85 : 0,
        evidence: pkgRadix ? ['@radix-ui/* packages found'] : hasImport ? ['@radix-ui imports found'] : [],
      };
    },
  },
  {
    name: 'Node.js',
    category: 'runtime',
    detect: (files: FileIndex) => {
      const hasPackageJson = Object.keys(files).some((f) => f.endsWith('package.json'));
      const hasNodeModules = Object.values(files).some((c) => c.includes('require(') || c.includes('process.env') || c.includes('__dirname'));
      return {
        detected: hasPackageJson || hasNodeModules,
        confidence: hasPackageJson ? 0.9 : hasNodeModules ? 0.6 : 0,
        evidence: hasPackageJson ? ['package.json found'] : hasNodeModules ? ['Node.js APIs detected'] : [],
      };
    },
  },
  {
    name: 'React Router',
    category: 'framework',
    detect: (files: FileIndex) => {
      const hasImport = Object.values(files).some((c) => /from\s+['"]react-router['"]/.test(c) || /from\s+['"]react-router-dom['"]/.test(c));
      return {
        detected: hasImport,
        confidence: hasImport ? 0.9 : 0,
        evidence: hasImport ? ['react-router imports found'] : [],
      };
    },
  },
  {
    name: 'Zustand',
    category: 'framework',
    detect: (files: FileIndex) => {
      const hasImport = Object.values(files).some((c) => /from\s+['"]zustand['"]/.test(c));
      return {
        detected: hasImport,
        confidence: hasImport ? 0.9 : 0,
        evidence: hasImport ? ['zustand imports found'] : [],
      };
    },
  },
  {
    name: 'Biome',
    category: 'tool',
    detect: (files: FileIndex) => {
      const hasConfig = Object.keys(files).some((f) => f.includes('biome') || f.includes('.biome'));
      return {
        detected: hasConfig,
        confidence: hasConfig ? 1 : 0,
        evidence: hasConfig ? ['biome config found'] : [],
      };
    },
  },
];

export function detectTechnologies(files: FileIndex): DetectedTechnology[] {
  const result: DetectedTechnology[] = [];
  for (const sig of TECH_SIGNATURES) {
    const { detected, confidence, evidence } = sig.detect(files);
    if (detected) {
      result.push({ name: sig.name, category: sig.category, confidence, evidence });
    }
  }
  return result.sort((a, b) => b.confidence - a.confidence);
}
