import type { ContextPackage, ContextPurpose } from '@gamedev-agent/context';
import type {
  Capability,
  Message,
  ModelResponse,
  TokenUsage,
  ToolCall,
} from '@gamedev-agent/model-providers';
import type { WorkflowStep, WorkflowStepContext } from '@gamedev-agent/workflow';

// ─── Context Assembly ──────────────────────────────────────────────────────

export interface AssembledContext {
  readonly systemPrompt: string;
  readonly messages: readonly Message[];
  readonly contextPackage: ContextPackage;
  readonly modelId: string;
  readonly maxTokens: number;
  readonly requiredCapabilities: readonly Capability[];
}

// ─── Agent Dispatch ────────────────────────────────────────────────────────

export interface DispatchContext {
  readonly messages: readonly Message[];
  readonly tools?: readonly ToolDefinition[];
  readonly signal?: AbortSignal;
  readonly metadata?: Record<string, unknown>;
}

export interface AgentDispatchResult {
  readonly response: ModelResponse;
  readonly toolCalls: readonly ToolCall[];
}

// ─── Tool Invocation ───────────────────────────────────────────────────────

export interface ToolInvocation {
  readonly toolCall: ToolCall;
  readonly result: string;
  readonly ok: boolean;
  readonly durationMs: number;
}

// ─── Execution Result ──────────────────────────────────────────────────────

export interface ExecutionStepResult {
  readonly ok: boolean;
  readonly error?: string;
  readonly usage: TokenUsage;
  readonly toolCalls: readonly ToolCall[];
  readonly rounds: number;
  readonly totalLatencyMs: number;
}

// ─── Capability Mapping ────────────────────────────────────────────────────

export interface CapabilityMapping {
  readonly role: string;
  readonly purpose: ContextPurpose;
  readonly capabilities: readonly Capability[];
}

// ─── Execution Options ─────────────────────────────────────────────────────

export interface ExecutionOptions {
  readonly timeoutMs?: number;
  readonly maxToolRounds?: number;
  readonly onProgress?: (content: string, round: number) => void;
  readonly onToolCall?: (toolCall: ToolCall, round: number) => void;
}

// ─── Tool Definition (subset of ModelProvider types, local to avoid deep imports) ─

export interface ToolDefinition {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: Record<string, unknown>;
  readonly strict?: boolean;
}

// ─── Memory Recording ──────────────────────────────────────────────────────

export interface ExecutionMemoryInput {
  readonly step: WorkflowStep;
  readonly context: WorkflowStepContext;
  readonly result: ExecutionStepResult;
  readonly startTime: number;
}

// ─── Capability Router ─────────────────────────────────────────────────────

export function mapStepToCapabilities(step: WorkflowStep): CapabilityMapping {
  const role = step.requiredRole ?? 'executor';
  const purpose = mapCapabilityToPurpose(step.requiredCapability);
  const capabilities = computeCapabilities(step);
  return { role, purpose, capabilities };
}

function mapCapabilityToPurpose(capability?: string): ContextPurpose {
  switch (capability) {
    case 'code-generation':
    case 'codegen':
      return 'codegen';
    case 'code-review':
    case 'review':
      return 'review';
    case 'debug':
    case 'debugging':
      return 'debug';
    case 'planning':
    case 'architecture':
      return 'planning';
    default:
      return 'explore';
  }
}

function computeCapabilities(step: WorkflowStep): readonly Capability[] {
  const caps: Capability[] = ['chat'];
  const capability = step.requiredCapability ?? '';
  if (capability.includes('code')) caps.push('tool_calling');
  if (step.metadata?.structured_output === true) caps.push('structured_output');
  if (step.metadata?.vision === true) caps.push('vision');
  return caps;
}
