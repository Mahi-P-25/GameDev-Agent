import { describe, expect, it } from 'vitest';
import type { Capability } from '../src/Capability';
import { CapabilityContextImpl } from '../src/CapabilityContext';
import { asCapabilityId } from '../src/CapabilityDescriptor';
import type { CapabilityDescriptor } from '../src/CapabilityDescriptor';
import {
  BLENDER_DESCRIPTOR,
  BROWSER_DESCRIPTOR,
  BUILT_IN_CAPABILITIES,
  BlenderCapability,
  BrowserCapability,
  FILESYSTEM_DESCRIPTOR,
  FilesystemCapability,
  GIT_DESCRIPTOR,
  GitCapability,
  TERMINAL_DESCRIPTOR,
  THREE_JS_DESCRIPTOR,
  TerminalCapability,
  ThreeJsCapability,
  VSCODE_DESCRIPTOR,
  VSCodeCapability,
} from '../src/index';

const EXAMPLES: ReadonlyArray<{ descriptor: CapabilityDescriptor; capability: Capability }> = [
  { descriptor: VSCODE_DESCRIPTOR, capability: new VSCodeCapability() },
  { descriptor: GIT_DESCRIPTOR, capability: new GitCapability() },
  { descriptor: FILESYSTEM_DESCRIPTOR, capability: new FilesystemCapability() },
  { descriptor: TERMINAL_DESCRIPTOR, capability: new TerminalCapability() },
  { descriptor: BROWSER_DESCRIPTOR, capability: new BrowserCapability() },
  { descriptor: BLENDER_DESCRIPTOR, capability: new BlenderCapability() },
  { descriptor: THREE_JS_DESCRIPTOR, capability: new ThreeJsCapability() },
];

function ctx(capability: Capability, input: unknown) {
  return new CapabilityContextImpl(capability.id, input as never);
}

describe('built-in capabilities', () => {
  it('ships exactly seven example capabilities', () => {
    expect(BUILT_IN_CAPABILITIES).toHaveLength(7);
    for (const cap of BUILT_IN_CAPABILITIES) {
      expect(cap.descriptor.id).toMatch(/^nova\.capability\./);
    }
  });

  it('every example has a stable id matching its descriptor', () => {
    for (const { descriptor, capability } of EXAMPLES) {
      expect(capability.id).toBe(asCapabilityId(descriptor.id));
    }
  });

  it('every descriptor declares id, name, version, category and platforms', () => {
    for (const { descriptor } of EXAMPLES) {
      expect(descriptor.name.length).toBeGreaterThan(0);
      expect(descriptor.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(descriptor.supportedPlatforms.length).toBeGreaterThan(0);
      expect(descriptor.permissions).toBeDefined();
      expect(descriptor.inputs).toBeDefined();
      expect(descriptor.outputs).toBeDefined();
    }
  });
});

describe('example capability run contracts (no real execution)', () => {
  it('VS Code accepts open with a path and rejects missing path', async () => {
    const cap = new VSCodeCapability();
    const ok = await cap.execute(ctx(cap, { action: 'open', path: 'a.ts' }));
    expect(ok.ok).toBe(true);
    const bad = await cap.execute(ctx(cap, { action: 'open' }));
    expect(bad.ok).toBe(false);
  });

  it('Git commit requires a message', async () => {
    const cap = new GitCapability();
    const bad = await cap.execute(ctx(cap, { command: 'commit' }));
    expect(bad.ok).toBe(false);
    const ok = await cap.execute(ctx(cap, { command: 'commit', message: 'fix' }));
    expect(ok.ok).toBe(true);
  });

  it('Filesystem requires a path', async () => {
    const cap = new FilesystemCapability();
    const bad = await cap.execute(ctx(cap, { operation: 'read' }));
    expect(bad.ok).toBe(false);
  });

  it('Terminal requires a command', async () => {
    const cap = new TerminalCapability();
    const bad = await cap.execute(ctx(cap, {}));
    expect(bad.ok).toBe(false);
  });

  it('Browser navigate requires a url', async () => {
    const cap = new BrowserCapability();
    const bad = await cap.execute(ctx(cap, { action: 'navigate' }));
    expect(bad.ok).toBe(false);
  });

  it('Three.js add-mesh requires a spec', async () => {
    const cap = new ThreeJsCapability();
    const bad = await cap.execute(ctx(cap, { operation: 'add-mesh' }));
    expect(bad.ok).toBe(false);
  });

  it('Blender reports healthy by default', async () => {
    expect(await new BlenderCapability().health()).toBe('healthy');
  });

  it('does not throw on construction / is purely a typed stub', () => {
    expect(() => new VSCodeCapability()).not.toThrow();
  });
});
