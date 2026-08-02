import type { Json } from '@gamedev-agent/shared';
import type { ContextSourceName } from './ContextPackage';

export type AgentRole =
  | 'creative-director'
  | 'executor'
  | 'analyst'
  | 'architect'
  | 'code-reviewer'
  | '*';

export type ContextPurpose = 'planning' | 'codegen' | 'debug' | 'review' | 'explore';

export interface ContextRequest {
  readonly role: AgentRole;
  readonly purpose: ContextPurpose;
  readonly maxTokens: number;
  readonly query?: string;
  readonly requiredSources?: readonly ContextSourceName[];
  readonly excludeSources?: readonly ContextSourceName[];
  readonly metadata?: Readonly<Record<string, Json>>;
}
