import { describe, expect, it } from 'vitest';
import { asCapabilityId } from '../src/CapabilityDescriptor';
import {
  CapabilityDisabledError,
  CapabilityError,
  CapabilityInputError,
  CapabilityNotFoundError,
  DuplicateCapabilityError,
  PermissionDeniedError,
  ToolUnavailableError,
  UnsupportedPlatformError,
  type ValidationViolation,
} from '../src/CapabilityErrors';

const ID = asCapabilityId('nova.capability.x');

describe('CapabilityErrors', () => {
  it('all errors extend CapabilityError and carry the id', () => {
    const errors = [
      new CapabilityNotFoundError(ID),
      new CapabilityDisabledError(ID),
      new DuplicateCapabilityError(ID),
      new UnsupportedPlatformError(ID, 'web', ['win32']),
      new PermissionDeniedError(ID, ['fs.write']),
      new ToolUnavailableError(ID, 'git', 'not found'),
    ];
    for (const error of errors) {
      expect(error).toBeInstanceOf(CapabilityError);
      expect(error.capabilityId).toBe(ID);
      expect(error.message.length).toBeGreaterThan(0);
    }
  });

  it('UnsupportedPlatformError reports platform and supported set', () => {
    const error = new UnsupportedPlatformError(ID, 'web', ['win32', 'linux']);
    expect(error.platform).toBe('web');
    expect(error.supported).toEqual(['win32', 'linux']);
  });

  it('PermissionDeniedError reports missing permissions', () => {
    const error = new PermissionDeniedError(ID, ['a', 'b']);
    expect(error.missing).toEqual(['a', 'b']);
  });

  it('CapabilityInputError aggregates violations', () => {
    const violations: ReadonlyArray<ValidationViolation> = [{ path: 'value', message: 'required' }];
    const error = new CapabilityInputError(ID, violations);
    expect(error.violations).toBe(violations);
    expect(error.message).toContain('value');
  });
});
