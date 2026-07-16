import { NAMESPACE_SEPARATOR } from '@gamedev-agent/shared';
import { describe, expect, it } from 'vitest';

describe('studio foundation', () => {
  it('exposes the namespace separator used by the Memory Kernel', () => {
    expect(NAMESPACE_SEPARATOR).toBe('/');
  });

  it('keeps the shared package dependency-free and stable', () => {
    expect(typeof NAMESPACE_SEPARATOR).toBe('string');
  });
});
