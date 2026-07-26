import { describe, expect, it } from 'vitest';
import { ProjectValidationError } from './ProjectErrors';
import { ProjectFactory } from './ProjectFactory';
import { FixedClock, SequenceIdGenerator } from './test_helpers';

const makeFactory = () =>
  new ProjectFactory({ clock: new FixedClock(), idGenerator: new SequenceIdGenerator() });

describe('ProjectFactory — create', () => {
  it('produces a valid project with applied defaults', () => {
    const factory = makeFactory();
    const project = factory.create({ name: 'My Game', rootPath: '/games/my-game' });

    expect(project.id).toBe('id-1');
    expect(project.name).toBe('My Game');
    expect(project.description).toBe('');
    expect(project.rootPath).toBe('/games/my-game');
    expect(project.engine).toBe('none');
    expect(project.language).toBe('typescript');
    expect(project.targetPlatforms).toEqual(['web']);
    expect(project.status).toBe('draft');
    expect(project.createdAt).toBe(1_700_000_000_000);
    expect(project.updatedAt).toBe(1_700_000_000_000);
    expect(project.tags).toEqual([]);
    expect(project.metadata).toEqual({});
    expect(project.workspace).toEqual({});
    expect(project.git).toEqual({ enabled: false });
    expect(project.plugins).toEqual({ enabled: [] });
    expect(project.model).toEqual({});
  });

  it('derives stable, namespaced memory/knowledge/mission namespaces from the name', () => {
    const factory = makeFactory();
    const project = factory.create({ name: 'Space  Adventure!', rootPath: '/x' });

    expect(project.memoryNamespace).toBe('space-adventure/memory');
    expect(project.knowledgeNamespace).toBe('space-adventure/knowledge');
    expect(project.missionNamespace).toBe('space-adventure/mission');
  });

  it('normalizes root paths (trailing slashes, backslashes)', () => {
    const factory = makeFactory();
    const project = factory.create({ name: 'P', rootPath: 'C:\\games\\p\\\\' });
    expect(project.rootPath).toBe('C:/games/p');
  });

  it('trims name and description whitespace', () => {
    const factory = makeFactory();
    const project = factory.create({ name: '  Trimmed  ', rootPath: '/x', description: '  hi  ' });
    expect(project.name).toBe('Trimmed');
    expect(project.description).toBe('hi');
  });

  it('throws ProjectValidationError when name is empty', () => {
    const factory = makeFactory();
    expect(() => factory.create({ name: '   ', rootPath: '/x' })).toThrowError(/name is required/);
  });

  it('throws ProjectValidationError for an unknown engine', () => {
    const factory = makeFactory();
    expect(() =>
      factory.create({ name: 'P', rootPath: '/x', engine: 'frobnix' as never }),
    ).toThrowError(/engine must be one of/);
  });

  it('honors provided engine, language, platforms, tags, and sub-configs', () => {
    const factory = makeFactory();
    const project = factory.create({
      name: 'P',
      rootPath: '/x',
      engine: 'unity',
      language: 'csharp',
      targetPlatforms: ['windows', 'xbox'],
      tags: ['rpg', 'cozy'],
      workspace: { layout: 'split' },
      git: { enabled: true, defaultBranch: 'main' },
      plugins: { enabled: ['terrain'] },
      model: { defaultModel: 'nova-large' },
    });
    expect(project.engine).toBe('unity');
    expect(project.language).toBe('csharp');
    expect(project.targetPlatforms).toEqual(['windows', 'xbox']);
    expect(project.tags).toEqual(['rpg', 'cozy']);
    expect(project.workspace.layout).toBe('split');
    expect(project.git.defaultBranch).toBe('main');
    expect(project.plugins.enabled).toEqual(['terrain']);
    expect(project.model.defaultModel).toBe('nova-large');
  });
});

describe('ProjectFactory — update', () => {
  it('returns a new instance without mutating the original', () => {
    const factory = makeFactory();
    const original = factory.create({ name: 'P', rootPath: '/x' });
    const updated = factory.update(original, { name: 'Q' });

    expect(original.name).toBe('P');
    expect(updated.name).toBe('Q');
    expect(updated.id).toBe(original.id);
    expect(updated.createdAt).toBe(original.createdAt);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(original.updatedAt);
  });

  it('deep-merges sub-configs instead of replacing them', () => {
    const factory = makeFactory();
    const original = factory.create({
      name: 'P',
      rootPath: '/x',
      git: { enabled: true },
      model: { defaultModel: 'a' },
    });
    const updated = factory.update(original, { model: { executionModel: 'b' } });
    expect(updated.git.enabled).toBe(true);
    expect(updated.model.defaultModel).toBe('a');
    expect(updated.model.executionModel).toBe('b');
  });

  it('re-validates and rejects invalid patches', () => {
    const factory = makeFactory();
    const original = factory.create({ name: 'P', rootPath: '/x' });
    expect(() => factory.update(original, { name: '' })).toThrowError(ProjectValidationError);
    try {
      factory.update(original, { name: '' });
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectValidationError);
      expect((error as ProjectValidationError).violations.some((v) => v.field === 'name')).toBe(
        true,
      );
    }
  });
});

describe('ProjectFactory — withStatus', () => {
  it('transitions status and re-stamps updatedAt, preserving identity', () => {
    const factory = makeFactory();
    const original = factory.create({ name: 'P', rootPath: '/x' });
    const opened = factory.withStatus(original, 'open');
    expect(opened.status).toBe('open');
    expect(opened.id).toBe(original.id);
    expect(opened.name).toBe(original.name);
  });
});
