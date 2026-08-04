import type { DirectoryNode, FileIndex } from '../types';

const HIDDEN_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.next',
  'build',
  '.cache',
  '__pycache__',
]);
const SOURCE_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.css',
  '.json',
  '.md',
  '.html',
  '.glsl',
  '.frag',
  '.vert',
]);

export function analyzeStructure(files: FileIndex): DirectoryNode[] {
  const pathMap = new Map<string, { names: string[]; files: string[] }>();
  const dirs = new Set<string>();

  for (const filePath of Object.keys(files)) {
    const normalized = filePath.replace(/\\/g, '/').replace(/^\//, '');
    const parts = normalized.split('/');
    const fileName = parts.pop() ?? '';
    const ext = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '';

    if (!SOURCE_EXTS.has(ext)) continue;

    let current = '';
    for (const part of parts) {
      if (HIDDEN_DIRS.has(part)) break;
      current = current ? `${current}/${part}` : part;
      dirs.add(current);
    }

    if (current && !HIDDEN_DIRS.has(fileName)) {
      const entry = pathMap.get(current) ?? { names: [], files: [] };
      entry.files.push(fileName);
      pathMap.set(current, entry);
    }
  }

  const buildNode = (dirPath: string, level: number): DirectoryNode => {
    const parts = dirPath.split('/');
    const name = parts[parts.length - 1] ?? parts[0] ?? '';
    const entry = pathMap.get(dirPath);

    const childDirs = [...dirs]
      .filter((d) => {
        const parent = d.substring(0, d.lastIndexOf('/'));
        return parent === dirPath || (level === 0 && !d.includes('/'));
      })
      .filter((d) => d !== dirPath);

    const children: DirectoryNode[] = [];

    for (const childDir of childDirs) {
      children.push(buildNode(childDir, level + 1));
    }

    if (entry) {
      for (const fileName of entry.files) {
        children.push({
          name: fileName,
          path: `${dirPath}/${fileName}`,
          type: 'file',
        });
      }
    }

    return {
      name,
      path: dirPath,
      type: 'directory',
      ...(children.length > 0 ? { children: children as readonly DirectoryNode[] } : {}),
      fileCount: entry?.files.length ?? 0,
    } as DirectoryNode;
  };

  const topLevelDirs = [...dirs].filter((d) => !d.includes('/'));
  const rootNodes: DirectoryNode[] = [];

  for (const dir of topLevelDirs) {
    rootNodes.push(buildNode(dir, 0));
  }

  rootNodes.sort((a, b) => (b.fileCount ?? 0) - (a.fileCount ?? 0));
  return rootNodes;
}
