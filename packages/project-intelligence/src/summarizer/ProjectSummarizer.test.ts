import type { ProjectId } from '@gamedev-agent/project';
import { describe, expect, it } from 'vitest';
import { ProjectIndexCache } from '../cache/ProjectIndexCache';
import type { FileIndex } from '../types';
import { ProjectSummarizer } from './ProjectSummarizer';

const PID = 'p1' as ProjectId;

const PROJECT_FILES: FileIndex = {
  'package.json': '{"name": "demo", "dependencies": {"three": "^0.160.0"}}',
  'src/index.ts': 'import { Scene } from "three"; export const scene = new Scene();',
  'src/scenes/GameScene.ts': 'export class GameScene {}',
  'tsconfig.json': '{"compilerOptions": {"strict": true}}',
  'README.md': '# Demo',
};

const PROJECT_CHANGED: FileIndex = {
  ...PROJECT_FILES,
  'src/scenes/GameScene.ts': 'export class GameScene { update() {} }',
};

describe('ProjectSummarizer', () => {
  it('composes a full ProjectContext on the first scan', () => {
    const summarizer = new ProjectSummarizer();
    const result = summarizer.summarize(PID, '/repo', PROJECT_FILES);

    expect(result.incremental).toBe(false);
    expect(result.delta.changedCount).toBe(5);
    expect(result.context.workspacePath).toBe('/repo');
    expect(result.context.scan?.packageManager).toBe('npm');
    expect(result.context.scan?.language).toBe('TypeScript');
    expect(result.context.folders?.folders).toContain('src');
    expect(result.context.dependencies?.dependencies.three).toBe('^0.160.0');
    expect(result.context.source?.classes.map((c) => c.name)).toContain('GameScene');
    expect(result.context.statistics?.sourceFiles).toBe(2);
    expect(result.context.metadata?.name).toBe('demo');
  });

  it('reuses the cached projection when nothing changed', () => {
    const summarizer = new ProjectSummarizer();
    summarizer.summarize(PID, '/repo', PROJECT_FILES);
    const first = summarizer.get(PID);

    const second = summarizer.summarize(PID, '/repo', PROJECT_FILES);
    expect(second.incremental).toBe(true);
    expect(second.context).toBe(first);
    expect(second.delta.changedCount).toBe(0);
  });

  it('recomputes when files changed', () => {
    const summarizer = new ProjectSummarizer();
    summarizer.summarize(PID, '/repo', PROJECT_FILES);

    const result = summarizer.summarize(PID, '/repo', PROJECT_CHANGED);
    expect(result.incremental).toBe(false);
    expect(result.delta.changed).toEqual(['src/scenes/GameScene.ts']);
    expect(result.context.scanTimestamp).toBeDefined();
  });

  it('does not reuse across different root paths', () => {
    const summarizer = new ProjectSummarizer();
    summarizer.summarize(PID, '/repo-a', PROJECT_FILES);

    const result = summarizer.summarize(PID, '/repo-b', PROJECT_FILES);
    expect(result.incremental).toBe(false);
  });

  it('supports get/has/invalidate', () => {
    const summarizer = new ProjectSummarizer();
    expect(summarizer.has(PID)).toBe(false);

    summarizer.summarize(PID, '/repo', PROJECT_FILES);
    expect(summarizer.has(PID)).toBe(true);
    expect(summarizer.get(PID)).not.toBeNull();

    summarizer.invalidate(PID);
    expect(summarizer.has(PID)).toBe(false);
    expect(summarizer.get(PID)).toBeNull();
  });

  it('accepts an injected cache', () => {
    const cache = new ProjectIndexCache<ReturnType<ProjectSummarizer['get']>>();
    const summarizer = new ProjectSummarizer({ cache });

    summarizer.summarize(PID, '/repo', PROJECT_FILES);
    expect(cache.has(PID)).toBe(true);
  });
});
