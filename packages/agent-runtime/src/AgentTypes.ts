import type { Brand, Json, Timestamp, UUID } from '@gamedev-agent/shared';
import type { Agent } from './AgentInterface';

export type { Json };

export type AgentId = Brand<UUID, 'AgentId'>;
export type AgentType = Brand<string, 'AgentType'>;
export type AgentCapability = Brand<string, 'AgentCapability'>;

export type AgentStatus = 'idle' | 'busy' | 'paused' | 'error' | 'stopped';

export type AgentMessageTarget =
  | { readonly kind: 'agent'; readonly agentId: AgentId }
  | { readonly kind: 'capability'; readonly capability: AgentCapability }
  | { readonly kind: 'broadcast'; readonly type?: AgentType };

export interface AgentMessage {
  readonly id: string;
  readonly source: AgentId;
  readonly target: AgentMessageTarget;
  readonly type: string;
  readonly payload: Json;
  readonly correlationId: string | null;
  readonly timestamp: Timestamp;
}

export interface AgentTypeDescriptor {
  readonly type: AgentType;
  readonly name: string;
  readonly description: string;
  readonly capabilities: ReadonlyArray<AgentCapability>;
  readonly factory: () => Agent;
}

export interface AgentHandle {
  readonly id: AgentId;
  readonly type: AgentType;
  readonly capabilities: ReadonlySet<AgentCapability>;
  readonly status: AgentStatus;
}

export interface AgentRequest {
  readonly target: AgentMessageTarget;
  readonly type: string;
  readonly payload: Json;
  readonly timeoutMs?: number;
}

export const AGENT_STATUSES: ReadonlyArray<AgentStatus> = [
  'idle',
  'busy',
  'paused',
  'error',
  'stopped',
];

export const DEFAULT_MESSAGE_TIMEOUT_MS = 30_000;
export const MAX_MESSAGE_PAYLOAD_SIZE = 1_048_576;
