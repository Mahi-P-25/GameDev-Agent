import type { FileIndex, AssetInventory } from './types';

const ASSET_PATTERNS: Record<string, readonly string[]> = {
  models: ['.glb', '.gltf', '.fbx', '.obj', '.blend', '.dae', '.3ds', '.stl'],
  textures: ['.png', '.jpg', '.jpeg', '.tga', '.dds', '.exr', '.hdr', '.tiff', '.tif', '.webp', '.svg', '.bmp'],
  shaders: ['.glsl', '.frag', '.vert', '.geom', '.comp', '.tesc', '.tese', '.hlsl', '.spv'],
  animations: ['.anim', '.bvh', '.vca', '.pma'],
  audio: ['.wav', '.mp3', '.ogg', '.aac', '.flac', '.m4a', '.wma', '.aiff'],
};

export function scanAssets(files: FileIndex): AssetInventory {
  const locations = new Set<string>();
  let models = 0;
  let textures = 0;
  let shaders = 0;
  let animations = 0;
  let audio = 0;
  let other = 0;

  for (const filePath of Object.keys(files)) {
    const normalized = filePath.replace(/\\/g, '/');
    const ext = '.' + (normalized.split('.').pop() ?? '').toLowerCase();

    let matched = false;
    for (const [category, extensions] of Object.entries(ASSET_PATTERNS)) {
      if ((extensions as readonly string[]).includes(ext)) {
        if (category === 'models') models++;
        else if (category === 'textures') textures++;
        else if (category === 'shaders') shaders++;
        else if (category === 'animations') animations++;
        else if (category === 'audio') audio++;
        matched = true;
        break;
      }
    }

    if (!matched) {
      const content = files[filePath];
      if (content && content.length > 1000 && !normalized.endsWith('.ts') && !normalized.endsWith('.tsx') && !normalized.endsWith('.js')) {
        other++;
      }
    }

    const dir = normalized.includes('/') ? normalized.substring(0, normalized.lastIndexOf('/')) : '';
    if (dir) locations.add(dir);
  }

  return {
    models,
    textures,
    shaders,
    animations,
    audio,
    other,
    locations: [...locations].sort(),
  };
}
