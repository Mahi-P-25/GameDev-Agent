import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { SourceFile, ArchitectureInfo } from './types';

const THREE_PATTERNS: Array<[RegExp, string]> = [
  [/Scene\s*\(/g, 'Scene Graph'],
  [/Mesh\s*\(/g, 'Geometry & Meshes'],
  [/WebGLRenderer/g, 'Rendering Pipeline'],
  [/PerspectiveCamera/g, 'Camera System'],
  [/OrbitControls/g, 'Camera Controls'],
  [/Raycaster/g, 'Raycasting'],
  [/AnimationMixer/g, 'Animation System'],
  [/Clock\s*\(/g, 'Animation Loop'],
  [/Vector3\s*\(/g, '3D Math'],
  [/Quaternion/g, '3D Math'],
  [/Euler/g, '3D Math'],
  [/Matrix4/g, '3D Math'],
  [/BoxGeometry/g, 'Geometry & Meshes'],
  [/SphereGeometry/g, 'Geometry & Meshes'],
  [/PlaneGeometry/g, 'Geometry & Meshes'],
  [/MeshStandardMaterial/g, 'Materials'],
  [/MeshPhongMaterial/g, 'Materials'],
  [/ShaderMaterial/g, 'Shaders'],
  [/RawShaderMaterial/g, 'Shaders'],
  [/DirectionalLight/g, 'Lighting'],
  [/AmbientLight/g, 'Lighting'],
  [/PointLight/g, 'Lighting'],
  [/SpotLight/g, 'Lighting'],
  [/Group\s*\(/g, 'Scene Graph'],
  [/Object3D/g, 'Scene Graph'],
  [/BufferGeometry/g, 'Geometry & Meshes'],
  [/TextureLoader/g, 'Asset Loading'],
  [/GLTFLoader/g, 'Asset Loading'],
  [/FBXLoader/g, 'Asset Loading'],
  [/LoadingManager/g, 'Asset Loading'],
  [/DragControls/g, 'Interaction'],
  [/TransformControls/g, 'Interaction'],
  [/PointerLockControls/g, 'Interaction'],
  [/CSS2DRenderer/g, 'Rendering Pipeline'],
  [/CSS3DRenderer/g, 'Rendering Pipeline'],
  [/EffectComposer/g, 'Post-Processing'],
  [/UnrealBloomPass/g, 'Post-Processing'],
  [/SSAOPass/g, 'Post-Processing'],
  [/SMAAPass/g, 'Post-Processing'],
  [/OutlinePass/g, 'Post-Processing'],
];

const ARCH_PATTERNS: Array<[string, RegExp[], string]> = [
  ['Manager Pattern', [/class\s+\w+Manager\b/g, /\w+Manager\s*=/g, /\w+Manager\s*\(/g], 'Managers centralize a specific concern (scene management, input, assets, etc.)'],
  ['Service Pattern', [/class\s+\w+Service\b/g, /\w+Service\s*=/g, /\w+Service\s*\(/g], 'Stateless services encapsulate business logic'],
  ['Controller Pattern', [/class\s+\w+Controller\b/g, /\w+Controller\s*=/g], 'Controllers orchestrate user input and game state'],
  ['Component Pattern', [/class\s+\w+Component\b/g, /function\s+\w+Component\s*\(/g], 'Reusable self-contained components'],
  ['ECS Pattern', [/(?:entities|ecs|components|systems)\//g, /Entity\b/g, /Component\b.*class/g, /System\b.*class/g], 'Entity-Component-System architecture'],
  ['Factory Pattern', [/create\w+\s*=\s*\(/g, /build\w+\s*=\s*\(/g, /factory/i], 'Factory functions create configured objects'],
  ['Observer/Event Pattern', [/\.on\s*\(/g, /\.emit\s*\(/g, /addEventListener/g, /EventEmitter/g, /dispatchEvent/g], 'Event-driven communication between systems'],
  ['Plugin Architecture', [/\.use\s*\(/g, /register\s*\(/g, /plugin/i], 'Extensible via plugins or registered modules'],
];

function countMatches(content: string, re: RegExp): number {
  const matches = content.match(re);
  return matches ? matches.length : 0;
}

function detectThreePatterns(files: Array<{ path: string; content?: string }>): string[] {
  const found = new Set<string>();

  for (const file of files) {
    if (!file.content) continue;
    for (const [re, label] of THREE_PATTERNS) {
      if (re.test(file.content)) {
        found.add(label);
      }
    }
  }

  return Array.from(found).sort();
}

function detectSingletons(rootDir: string): string[] {
  const found: string[] = [];

  function checkFile(relPath: string) {
    const full = join(rootDir, relPath);
    if (!existsSync(full)) return;
    try {
      const content = readFileSync(full, 'utf-8');
      const re = /class\s+(\w+Manager)\b/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        if (m[1]) found.push(m[1]);
      }
    } catch {
      // ignore
    }
  }

  function walk(dir: string) {
    let entries2: string[];
    try {
      entries2 = readdirSync(dir);
    } catch {
      return;
    }
    const entries: string[] = [];
    for (const entry of entries2) {
      const full = join(dir, entry);
      let s: ReturnType<typeof statSync>;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules' && entry !== 'dist') {
        walk(full);
      } else if (s.isFile() && (entry.endsWith('.ts') || entry.endsWith('.js'))) {
        entries.push(full);
      }
    }
    for (const e of entries) {
      checkFile(e);
    }
  }

  walk(rootDir);
  return found;
}

export function analyzeArchitecture(sourceFiles: ReadonlyArray<SourceFile>, rootDir: string): ArchitectureInfo {
  const managers: string[] = [];
  const services: string[] = [];
  const controllers: string[] = [];
  const components: string[] = [];
  const systems: string[] = [];

  for (const file of sourceFiles) {
    const lc = file.path.toLowerCase();
    if (/\/managers?\//.test(lc) || file.path.toLowerCase().includes('manager')) managers.push(file.path);
    if (/\/services?\//.test(lc) || file.path.toLowerCase().includes('service')) services.push(file.path);
    if (/\/controllers?\//.test(lc) || file.path.toLowerCase().includes('controller')) controllers.push(file.path);
    if (/\/components?\//.test(lc) || file.path.toLowerCase().includes('component')) components.push(file.path);
    if (/\/systems?\//.test(lc) || file.path.toLowerCase().includes('system')) systems.push(file.path);
  }

  const allContent: Array<{ path: string; content?: string }> = [];
  for (const sf of sourceFiles) {
    const full = join(rootDir, sf.path);
    if (existsSync(full)) {
      try {
        allContent.push({ path: sf.path, content: readFileSync(full, 'utf-8') });
      } catch {
        allContent.push({ path: sf.path });
      }
    }
  }

  const detectedPatterns: string[] = [];
  const patternDescriptions: string[] = [];

  for (const [name, regexps, desc] of ARCH_PATTERNS) {
    let total = 0;
    for (const file of allContent) {
      if (!file.content) continue;
      for (const re of regexps) {
        total += countMatches(file.content, re);
      }
    }
    if (total > 0) {
      detectedPatterns.push(name);
      patternDescriptions.push(`${name}: ${desc}`);
    }
  }

  const threeFeatures = detectThreePatterns(allContent);
  if (threeFeatures.length > 0) {
    detectedPatterns.unshift('Three.js Features');
    patternDescriptions.unshift(`Uses: ${threeFeatures.join(', ')}`);
  }

  const singletons = detectSingletons(rootDir);
  const allManagers = singletons.length > 0
    ? Array.from(new Set([...managers, ...singletons])).sort()
    : managers.length > 0 ? managers.sort() : managers;

  const primaryPattern = detectedPatterns[0] ?? 'Vanilla / Custom';
  const descriptionLines: string[] = [];

  if (allManagers.length > 0) descriptionLines.push(`Managers: ${allManagers.length}`);
  if (services.length > 0) descriptionLines.push(`Services: ${services.length}`);
  if (controllers.length > 0) descriptionLines.push(`Controllers: ${controllers.length}`);
  if (components.length > 0) descriptionLines.push(`Components: ${components.length}`);
  if (systems.length > 0) descriptionLines.push(`Systems: ${systems.length}`);
  if (threeFeatures.length > 0) descriptionLines.push(`Three.js subsystems: ${threeFeatures.join(', ')}`);
  if (patternDescriptions.length > 0) descriptionLines.push(`Patterns: ${patternDescriptions.join('; ')}`);

  return {
    pattern: primaryPattern,
    managers: allManagers,
    services: services.sort(),
    controllers: controllers.sort(),
    components: components.sort(),
    systems: systems.sort(),
    description: descriptionLines.join('\n'),
  };
}
