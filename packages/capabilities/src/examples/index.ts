import type { Capability } from '../Capability';
import { BlenderCapability } from './BlenderCapability';
import { BrowserCapability } from './BrowserCapability';
import { FilesystemCapability } from './FilesystemCapability';
import { GitCapability } from './GitCapability';
import { TerminalCapability } from './TerminalCapability';
import { ThreeJsCapability } from './ThreeJsCapability';
import { VSCodeCapability } from './VSCodeCapability';

/** Every built-in capability the framework ships with in SPRINT-6. */
export const BUILT_IN_CAPABILITIES: ReadonlyArray<Capability> = [
  new VSCodeCapability(),
  new GitCapability(),
  new FilesystemCapability(),
  new TerminalCapability(),
  new BrowserCapability(),
  new BlenderCapability(),
  new ThreeJsCapability(),
];
