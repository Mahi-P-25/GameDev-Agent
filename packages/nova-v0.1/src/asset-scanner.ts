import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { join, extname, basename, relative, dirname } from 'node:path';
import type { Asset, AssetInfo, MissingReference } from './types';

const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', '.vite', 'build', 'out', '.cache', 'coverage', '.nyc_output']);

const ASSET_CATEGORIES: Record<string, string> = {
  '.glb': 'models',
  '.gltf': 'models',
  '.obj': 'models',
  '.fbx': 'models',
  '.dae': 'models',
  '.blend': 'models',
  '.3ds': 'models',
  '.ply': 'models',
  '.stl': 'models',
  '.png': 'textures',
  '.jpg': 'textures',
  '.jpeg': 'textures',
  '.webp': 'textures',
  '.ktx2': 'textures',
  '.exr': 'textures',
  '.hdr': 'textures',
  '.tga': 'textures',
  '.tiff': 'textures',
  '.bmp': 'textures',
  '.svg': 'textures',
  '.mtl': 'materials',
  '.glsl': 'shaders',
  '.vert': 'shaders',
  '.frag': 'shaders',
  '.wgsl': 'shaders',
  '.comp': 'shaders',
  '.mp3': 'audio',
  '.ogg': 'audio',
  '.wav': 'audio',
  '.aac': 'audio',
  '.flac': 'audio',
  '.m4a': 'audio',
  '.anim': 'animations',
  '.clip': 'animations',
};

const TEXTURE_REF_RE = /(?:url\s*\(\s*['"]?)([^'")\s]+(?:\.png|\.jpg|\.jpeg|\.webp|\.ktx2|\.exr|\.hdr|\.tga|\.tiff|\.bmp)(?:\?[^'")\s]*)?)(?:['"]?\s*\))/gi;
const MODEL_REF_RE = /(?:loader\s*\.\s*(?:load|parse)\s*\(\s*['"]|\.load\s*\(\s*['"]|loadGLTF\s*\(\s*['"]|asset\s*:\s*['"]|url\s*:\s*['"])([^'"]+\.(?:glb|gltf|obj|fbx|dae|blend))/gi;
const ASSET_REF_RE = /['"]((?:assets?\/|textures?\/|models?\/|sounds?\/|audio\/|shaders?\/|animations?\/)[^'"]+)['"]/gi;

function walkFiles(rootDir: string): string[] {
  const result: string[] = [];

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry) || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      let s: ReturnType<typeof statSync>;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        walk(full);
      } else if (s.isFile()) {
        result.push(full);
      }
    }
  }

  walk(rootDir);
  return result;
}

function buildAsset(filePath: string, rootDir: string): Asset {
  const ext = extname(filePath).toLowerCase();
  const name = basename(filePath);
  let sizeBytes = 0;
  try {
    const s = statSync(filePath);
    sizeBytes = Number(s.size);
  } catch {
    // keep 0
  }

  const metadata: Record<string, string> = {};
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
    metadata.type = 'raster';
  } else if (ext === '.svg') {
    metadata.type = 'vector';
  } else if (ext === '.hdr' || ext === '.exr') {
    metadata.type = 'hdr';
  } else if (ext === '.glb') {
    metadata.type = 'binary';
  } else if (ext === '.gltf') {
    metadata.type = 'json';
  }

  return {
    path: relative(rootDir, filePath),
    name,
    format: ext.slice(1),
    sizeBytes,
    metadata,
  };
}

function collectSourceFiles(rootDir: string): string[] {
  const sourceExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.html', '.css', '.glsl', '.vert', '.frag', '.wgsl']);
  const files: string[] = [];

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry) || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      let s: ReturnType<typeof statSync>;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        walk(full);
      } else if (s.isFile() && sourceExts.has(extname(entry))) {
        files.push(full);
      }
    }
  }

  walk(rootDir);
  return files;
}

function detectMissingReferences(rootDir: string, knownAssets: Set<string>): MissingReference[] {
  const missing: MissingReference[] = [];
  const sourceFiles = collectSourceFiles(rootDir);
  const assetRelPaths = new Set<string>();
  for (const assetPath of knownAssets) {
    assetRelPaths.add(assetPath.replace(/\\/g, '/'));
  }

  for (const file of sourceFiles) {
    let content: string;
    try {
      content = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

      const refs = new Map<string, 'texture' | 'model' | 'unknown'>();

      let m: RegExpExecArray | null;
      const texRe = new RegExp(TEXTURE_REF_RE);
      while ((m = texRe.exec(content)) !== null) {
        if (m[1]) refs.set(m[1], 'texture');
      }

      const modelRe = new RegExp(MODEL_REF_RE);
      while ((m = modelRe.exec(content)) !== null) {
        if (m[1]) refs.set(m[1], 'model');
      }

      const assetRe = new RegExp(ASSET_REF_RE);
      while ((m = assetRe.exec(content)) !== null) {
        const ref = m[1];
        if (!ref) continue;
        const ext2 = extname(ref).toLowerCase();
        if (ext2 === '.png' || ext2 === '.jpg' || ext2 === '.jpeg' || ext2 === '.webp' || ext2 === '.ktx2') {
          refs.set(ref, 'texture');
        } else if (ext2 === '.glb' || ext2 === '.gltf' || ext2 === '.obj' || ext2 === '.fbx') {
          refs.set(ref, 'model');
        } else {
          refs.set(ref, 'unknown');
        }
      }

      const fileDir = dirname(file);
      for (const [ref, refType] of refs) {
        const normalizedRef = ref.replace(/\\/g, '/');
        const refFromFile = join(fileDir, normalizedRef);
        const refFromRoot = join(rootDir, normalizedRef);

        const relFromFile = relative(rootDir, refFromFile).replace(/\\/g, '/');
        const relFromRoot = relative(rootDir, refFromRoot).replace(/\\/g, '/');

        const existsFromFile = assetRelPaths.has(relFromFile) || existsSync(refFromFile);
        const existsFromRoot = assetRelPaths.has(relFromRoot) || existsSync(refFromRoot);

        if (!existsFromFile && !existsFromRoot) {
          missing.push({
            source: relative(rootDir, file),
            reference: ref,
            type: refType,
          });
        }
      }
  }

  return missing;
}

export function scanAssets(rootDir: string): AssetInfo {
  const allFiles = walkFiles(rootDir);

  const models: Asset[] = [];
  const textures: Asset[] = [];
  const materials: Asset[] = [];
  const shaders: Asset[] = [];
  const audio: Asset[] = [];
  const animations: Asset[] = [];
  const knownAssets = new Set<string>();

  for (const file of allFiles) {
    const ext = extname(file).toLowerCase();
    const category = ASSET_CATEGORIES[ext];
    if (!category) continue;

    const asset = buildAsset(file, rootDir);
    knownAssets.add(asset.path.replace(/\\/g, '/'));

    switch (category) {
      case 'models': models.push(asset); break;
      case 'textures': textures.push(asset); break;
      case 'materials': materials.push(asset); break;
      case 'shaders': shaders.push(asset); break;
      case 'audio': audio.push(asset); break;
      case 'animations': animations.push(asset); break;
    }
  }

  models.sort((a, b) => a.path.localeCompare(b.path));
  textures.sort((a, b) => a.path.localeCompare(b.path));
  materials.sort((a, b) => a.path.localeCompare(b.path));
  shaders.sort((a, b) => a.path.localeCompare(b.path));
  audio.sort((a, b) => a.path.localeCompare(b.path));
  animations.sort((a, b) => a.path.localeCompare(b.path));

  const missingReferences = detectMissingReferences(rootDir, knownAssets);

  return { models, textures, materials, shaders, audio, animations, missingReferences };
}
