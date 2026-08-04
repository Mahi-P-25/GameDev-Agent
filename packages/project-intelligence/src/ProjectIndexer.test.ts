import { EventBus } from '@gamedev-agent/events';
import {
  FILESYSTEM_TOOL_ID,
  FilesystemToolAdapter,
  ToolManager,
  filesystemDescriptor,
} from '@gamedev-agent/tool-runtime';
import { describe, expect, it } from 'vitest';
import { ProjectIndexer } from './ProjectIndexer';
import { SAMPLE_PROJECT, memoryFS } from './testHelpers';

function makeTools(): ToolManager {
  const manager = new ToolManager({
    eventBus: new EventBus({ source: 'test' }),
    platform: 'win32',
    grantedPermissions: ['fs.read', 'fs.write', 'fs.delete'],
  });
  manager.register(filesystemDescriptor, new FilesystemToolAdapter(memoryFS(SAMPLE_PROJECT)));
  return manager;
}

describe('ProjectIndexer', () => {
  it('walks the project tree through the Filesystem tool seam', async () => {
    const tools = makeTools();
    await tools.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });

    const indexer = new ProjectIndexer(tools);
    const fileIndex = await indexer.index('/demo');

    expect(Object.keys(fileIndex).sort()).toEqual([
      'README.md',
      'assets/textures/tiles.png',
      'package.json',
      'src/index.ts',
      'src/scenes/GameScene.ts',
      'tsconfig.json',
    ]);
  });

  it('captures content of text files but not binary extensions', async () => {
    const tools = makeTools();
    await tools.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });

    const indexer = new ProjectIndexer(tools);
    const fileIndex = await indexer.index('/demo');

    expect(fileIndex['package.json']).toContain('"three"');
    expect(fileIndex['src/scenes/GameScene.ts']).toContain('Scene');
    expect(fileIndex['assets/textures/tiles.png']).toBe('');
  });

  it('returns an empty index when no files exist under the root', async () => {
    const tools = makeTools();
    await tools.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });

    const indexer = new ProjectIndexer(tools);
    const fileIndex = await indexer.index('/empty');

    expect(fileIndex).toEqual({});
  });
});
