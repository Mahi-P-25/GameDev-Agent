import { describe, expect, it } from 'vitest';
import { ProjectValidationError } from './ProjectErrors';
import { ProjectFactory } from './ProjectFactory';
import { assertValidProject, validateProject, validateProjectFields } from './ProjectValidator';
import { FixedClock, SequenceIdGenerator } from './test_helpers';

const makeFactory = () =>
  new ProjectFactory({ clock: new FixedClock(), idGenerator: new SequenceIdGenerator() });

describe('ProjectValidator — validateProjectFields', () => {
  it('accepts a minimal valid init', () => {
    expect(validateProjectFields({ name: 'P', rootPath: '/x' })).toEqual([]);
  });

  it('flags an empty name', () => {
    const v = validateProjectFields({ name: '', rootPath: '/x' });
    expect(v.some((x) => x.field === 'name')).toBe(true);
  });

  it('flags a missing root path', () => {
    const v = validateProjectFields({ name: 'P', rootPath: '' });
    expect(v.some((x) => x.field === 'rootPath')).toBe(true);
  });

  it('flags non-array tags', () => {
    const v = validateProjectFields({ name: 'P', rootPath: '/x', tags: 'x' as never });
    expect(v.some((x) => x.field === 'tags')).toBe(true);
  });

  it('flags non-JSON-safe metadata', () => {
    const v = validateProjectFields({
      name: 'P',
      rootPath: '/x',
      metadata: { fn: (() => 0) as never },
    });
    expect(v.some((x) => x.field === 'metadata')).toBe(true);
  });

  it('flags an invalid git config', () => {
    const v = validateProjectFields({
      name: 'P',
      rootPath: '/x',
      git: { enabled: 'yes' } as never,
    });
    expect(v.some((x) => x.field === 'git.enabled')).toBe(true);
  });
});

describe('ProjectValidator — validateProject', () => {
  it('accepts a freshly created project', () => {
    const project = makeFactory().create({ name: 'P', rootPath: '/x' });
    expect(validateProject(project)).toEqual([]);
  });

  it('flags updatedAt earlier than createdAt', () => {
    const project = makeFactory().create({ name: 'P', rootPath: '/x' });
    const broken = { ...project, createdAt: 2000 as never, updatedAt: 1000 as never };
    const v = validateProject(broken);
    expect(v.some((x) => x.field === 'updatedAt')).toBe(true);
  });
});

describe('ProjectValidator — assertValidProject', () => {
  it('throws ProjectValidationError with violations on invalid data', () => {
    const project = makeFactory().create({ name: 'P', rootPath: '/x' });
    const broken = { ...project, status: 'bogus' as never };
    expect(() => assertValidProject(broken)).toThrow(ProjectValidationError);
    try {
      assertValidProject(broken);
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectValidationError);
      expect((error as ProjectValidationError).violations.length).toBeGreaterThan(0);
    }
  });
});
