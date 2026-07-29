import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { Message, ModelProvidersService } from '@gamedev-agent/model-providers';
import type { Disposable, Json, Timestamp } from '@gamedev-agent/shared';
import { CapabilityPlanner } from '@gamedev-agent/tool-runtime';
import type { MissionAbility, ResolvedCapability, ToolManager } from '@gamedev-agent/tool-runtime';
import type { WorkflowSource, WorkflowStep } from '@gamedev-agent/workflow';
import {
  AgentActionStarted,
  AgentActionResult,
  AgentArtifactCreated,
  AgentDecisionEvent,
  AgentMissionComplete,
  AgentObservation,
  AgentProgress,
  AgentStateChanged,
  AgentThought,
  AgentVerification,
} from './MissionAgentEvents';
import type {
  AgentAction,
  AgentDecision as Decision,
  AgentObservation as Observation,
  AgentState,
  AgentThought as Thought,
  AgentVerification as Verification,
  MissionAgentOptions,
  MissionReport,
  ShortTermMemory,
} from './MissionAgentTypes';

const TERMINAL_STATES: ReadonlySet<AgentState> = new Set(['completed', 'failed', 'cancelled']);

/**
 * MissionAgent — Nova's first autonomous mission brain.
 *
 * The agent owns the entire mission lifecycle:
 *   receive source → observe → think → decide → execute → verify → repeat
 *
 * It orchestrates existing systems (ToolManager, CapabilityPlanner,
 * ModelProviders, EventBus) — it never replaces them. The agent is the
 * decision-maker; ExecutionEngine remains the service for complex tool tasks.
 */
export class MissionAgent implements Disposable {
  private readonly toolManager: ToolManager;
  private readonly planner: CapabilityPlanner;
  private readonly modelProviders: ModelProvidersService;
  private readonly bus: EventBusContract;
  private readonly logger: Logger;
  private readonly defaultModel: string;

  private memory: ShortTermMemory | null = null;
  private state: AgentState = 'idle';
  private previousState: AgentState = 'idle';
  private abortSignal: AbortSignal | null = null;
  private disposed = false;

  constructor(options: MissionAgentOptions) {
    this.toolManager = options.toolManager;
    this.planner = options.capabilityPlanner ?? new CapabilityPlanner({ toolManager: options.toolManager });
    this.modelProviders = options.modelProviders;
    this.bus = options.eventBus;
    this.logger = options.logger ?? new RootLogger('nova.mission-agent', [new ConsoleLogSink()]);
    this.defaultModel = options.defaultModel ?? 'gpt-4o';
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Run a mission autonomously from a workflow source.
   * Accepts an optional AbortSignal for cancellation.
   */
  async run(source: WorkflowSource, signal?: AbortSignal): Promise<MissionReport> {
    if (this.disposed) throw new Error('MissionAgent is disposed');
    if (this.state === 'running') throw new Error('MissionAgent is already running');

    this.abortSignal = signal ?? null;
    const startTime = Date.now();

    this.memory = {
      source,
      missionId: source.missionId,
      projectId: source.projectId,
      goalTitle: `Mission: ${source.sourceId}`,
      startedAt: startTime,
      actions: [],
      observations: [],
      thoughts: [],
      verifications: [],
      decisions: [],
      failures: [],
      artifacts: [],
      openSessions: [],
      currentState: 'running',
    };

    await this.transitionTo('running');

    try {
      const steps = source.steps;
      let stepIndex = 0;

      while (stepIndex < steps.length && !this.isTerminal && !this.isCancelled) {
        const currentStep = steps[stepIndex]!;
        const completed = await this.executeStep(currentStep);
        if (!completed && this.state === 'cancelled') {
          break;
        }
        stepIndex++;
      }

      if (this.isCancelled) {
        await this.transitionTo('cancelled');
      } else {
        await this.transitionTo('completed');
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error('mission.agent-failed', { reason });
      const mem = this.memory;
      if (mem) {
        mem.failures.push({ action: 'mission-loop', reason, recovered: false });
      }
      await this.transitionTo('failed');
    }

    const mem = this.memory;
    if (mem) {
      mem.currentState = this.state;
    }
    const report = this.buildReport(startTime);
    await this.emitCompletion(report);
    return report;
  }

  /** Cancel a running mission. */
  cancel(): void {
    if (this.state === 'cancelled' || this.state === 'completed' || this.state === 'failed') return;
    this.state = 'cancelled';
  }

  dispose(): void {
    this.disposed = true;
    this.memory = null;
  }

  // ─── Per-step decision loop ─────────────────────────────────────────────

  private async executeStep(step: WorkflowStep): Promise<boolean> {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts && !this.isTerminal && !this.isCancelled) {
      attempts++;

      await this.transitionTo('observing');
      const observation = await this.observe(step);
      this.recordObservation(observation);

      await this.transitionTo('thinking');
      const thought = await this.think(step, observation);
      this.recordThought(thought);

      await this.transitionTo('deciding');
      const decision = await this.decide(step, thought, attempts, maxAttempts);
      this.recordDecision(decision);
      await this.emitDecision(decision);

      if (decision.type === 'abort') {
        const mem = this.memory;
        if (mem) {
          mem.failures.push({ action: step.title, reason: decision.reason, recovered: false });
        }
        return false;
      }

      if (decision.type === 'skip') {
        this.logger.info('mission.step-skipped', { step: step.id, reason: decision.reason });
        return true;
      }

      if (decision.type === 'complete') {
        return true;
      }

      if (decision.type === 'think_deeper') {
        await this.transitionTo('thinking');
        const deeperThought = await this.thinkDeep(step, thought, decision);
        this.recordThought(deeperThought);
        continue;
      }

      if (decision.type === 'request_approval') {
        await this.transitionTo('awaiting_approval');
        return false;
      }

      await this.transitionTo('executing');
      const action = await this.executeDecision(step, decision);
      this.recordAction(action);

      if (this.isCancelled) return false;

      await this.transitionTo('verifying');
      const verification = await this.verify(action, decision);
      this.recordVerification(verification);

      if (verification.passed) {
        this.logger.info('mission.step-verified', { step: step.id });
        return true;
      }

      const mem = this.memory;
      if (mem) {
        mem.failures.push({
          action: step.title,
          reason: `verification failed: ${verification.observed}`,
          recovered: attempts < maxAttempts,
        });
      }

      if (attempts >= maxAttempts) {
        this.logger.warn('mission.step-max-retries', { step: step.id, attempts });
      }
    }

    return false;
  }

  // ─── Observe ────────────────────────────────────────────────────────────

  private observe(step: WorkflowStep): Observation {
    const mem = this.memory;
    const lines: string[] = [
      `Step: ${step.title}`,
      `Description: ${step.description}`,
      `Required capability: ${step.requiredCapability ?? 'none'}`,
    ];

    if (mem && mem.actions.length > 0) {
      const last = mem.actions[mem.actions.length - 1];
      if (last) {
        lines.push(`Last action: ${last.ok ? 'succeeded' : 'failed'} — ${last.decision.type}`);
      }
    }

    if (mem) {
      lines.push(`Previous steps completed: ${mem.actions.filter(a => a.ok).length}`);
      lines.push(`Failures so far: ${mem.failures.length}`);
    }

    return {
      timestamp: Date.now(),
      kind: 'execution_result',
      content: lines.join('\n'),
    };
  }

  // ─── Think ─────────────────────────────────────────────────────────────

  private async think(step: WorkflowStep, _observation: Observation): Promise<Thought> {
    const availableAbilities = this.getAvailableAbilities();
    const systemPrompt = this.buildThinkPrompt(step, availableAbilities);
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Execute step "${step.title}": ${step.description}\n\nWhat is the next action? Respond with a JSON object.` },
    ];

    const response = await this.modelRequest(messages, 'thinking');
    const parsed = this.parseJsonResponse(response);

    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : 'Proceeding with step';
    const intention = typeof parsed.intention === 'string' ? parsed.intention : step.title;
    const capability = typeof parsed.capability === 'string' ? parsed.capability : (step.requiredCapability ?? 'read-files');

    return {
      timestamp: Date.now(),
      reasoning,
      intention: `${intention} (capability: ${capability})`,
    };
  }

  private async thinkDeep(step: WorkflowStep, previousThought: Thought, decision: import('./MissionAgentTypes').AgentDecision & { type: 'think_deeper' }): Promise<Thought> {
    const messages: Message[] = [
      { role: 'system', content: 'You are an autonomous game development engineer. Think more carefully about your approach.' },
      { role: 'user', content: [
        `Step: ${step.title}`,
        `Previous reasoning: ${previousThought.reasoning}`,
        `Deeper thinking needed. Reason: ${decision.reasoning}`,
        'What concrete action should be taken? Respond with JSON: {"reasoning": "...", "intention": "...", "capability": "..."}',
      ].join('\n') },
    ];

    const response = await this.modelRequest(messages, 'deeper-thinking');
    const parsed = this.parseJsonResponse(response);

    return {
      timestamp: Date.now(),
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : 'Re-evaluating approach',
      intention: typeof parsed.intention === 'string' ? parsed.intention : step.title,
    };
  }

  // ─── Decide ────────────────────────────────────────────────────────────

  private async decide(step: WorkflowStep, thought: Thought, _attempt: number, _maxAttempts: number): Promise<Decision> {
    const availableAbilities = this.getAvailableAbilities();
    const abilitiesList = availableAbilities.length > 0
      ? availableAbilities.map(a => `  - ${a}`).join('\n')
      : '  - read-files, write-files, run-commands, list-files, install-packages, version-control-init';

    const mem = this.memory;

    const messages: Message[] = [
      {
        role: 'system',
        content: [
          'You are an autonomous game development engineer. Decide the next action.',
          '',
          'Available abilities (choose one):',
          abilitiesList,
          '',
          'Respond with JSON. Examples:',
          '  {"type": "continue", "capability": "write-files", "params": {"path": "src/main.ts", "content": "..."}, "expected": "File created successfully"}',
          '  {"type": "continue", "capability": "run-commands", "params": {"command": "npm", "args": ["install"]}, "expected": "Dependencies installed"}',
          '  {"type": "retry", "reason": "file not found, need to create it first"}',
          '  {"type": "skip", "reason": "step not needed"}',
          '  {"type": "abort", "reason": "cannot proceed"}',
          '  {"type": "complete"}',
          '  {"type": "think_deeper", "reasoning": "need more context"}',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Mission: ${mem?.goalTitle ?? 'unknown'}`,
          `Step: ${step.title}`,
          `Description: ${step.description}`,
          `Required capability: ${step.requiredCapability ?? 'none'}`,
          `Thought: ${thought.reasoning}`,
          `Intention: ${thought.intention}`,
          '',
          'What is your decision?',
        ].join('\n'),
      },
    ];

    const response = await this.modelRequest(messages, 'deciding');
    return this.parseDecision(response);
  }

  // ─── Execute ────────────────────────────────────────────────────────────

  private async executeDecision(_step: WorkflowStep, decision: Decision): Promise<AgentAction> {
    if (decision.type !== 'continue') {
      return {
        timestamp: Date.now(),
        decision,
        resolvedCapability: null,
        input: null,
        output: null,
        ok: false,
        durationMs: 0,
        error: `skipped: ${decision.type}`,
      };
    }

    const startTime = Date.now();
    const resolved = this.resolveCapability(decision.capability);

    if (resolved === null || resolved.confidence === 'fallback') {
      this.logger.warn('mission.unresolved-capability', { capability: decision.capability });
      return {
        timestamp: Date.now(),
        decision,
        resolvedCapability: resolved,
        input: decision.params as Json,
        output: null,
        ok: false,
        durationMs: Date.now() - startTime,
        error: `unresolved capability: ${decision.capability}`,
      };
    }

    const mem = this.memory;
    await this.emitActionStarted(decision.capability, resolved, decision.params as Record<string, unknown>);

    try {
      const result = await this.toolManager.invoke({
        toolId: resolved.toolId,
        action: resolved.capabilityId,
        input: decision.params as Json,
        actor: { kind: 'mission-agent', id: mem?.missionId ?? 'unknown' },
        correlationId: null,
      });

      const action: AgentAction = {
        timestamp: Date.now(),
        decision,
        resolvedCapability: resolved,
        input: decision.params as Json,
        output: result.output,
        ok: result.ok,
        durationMs: result.durationMs,
        error: result.ok ? undefined : result.error?.message,
      };

      await this.emitActionResult(decision.capability, action);
      await this.emitProgress();

      if (result.ok && result.output !== null) {
        this.trackArtifacts(decision.capability, decision.params as Record<string, Json>, '');
      }

      return action;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        timestamp: Date.now(),
        decision,
        resolvedCapability: resolved,
        input: decision.params as Json,
        output: null,
        ok: false,
        durationMs: Date.now() - startTime,
        error: message,
      };
    }
  }

  // ─── Verify ─────────────────────────────────────────────────────────────

  private verify(action: AgentAction, decision: Decision): Verification {
    const expected = decision.type === 'continue' ? decision.expected : 'action completed';
    const observed = action.ok ? 'success' : `failed: ${action.error ?? 'unknown error'}`;
    const passed = action.ok;

    const verification: Verification = {
      timestamp: Date.now(),
      expected,
      observed,
      passed,
    };

    return verification;
  }

  // ─── Model helpers ──────────────────────────────────────────────────────

  private async modelRequest(messages: Message[], phase: string): Promise<string> {
    try {
      const response = await this.modelProviders.generate({
        messages,
        model: this.defaultModel,
        maxTokens: 1024,
        metadata: { phase, agent: 'mission-agent' },
        ...(this.abortSignal ? { signal: this.abortSignal } : {}),
      });
      return response.content ?? '';
    } catch (error) {
      this.logger.warn('mission.model-request-failed', {
        phase,
        error: error instanceof Error ? error.message : String(error),
      });
      return '{}';
    }
  }

  private parseJsonResponse(response: string): Record<string, unknown> {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      }
    } catch {
    }
    return {};
  }

  private parseDecision(response: string): Decision {
    const parsed = this.parseJsonResponse(response);
    const type = typeof parsed.type === 'string' ? parsed.type : 'continue';

    switch (type) {
      case 'continue':
        return {
          type: 'continue',
          capability: (typeof parsed.capability === 'string' ? parsed.capability : 'read-files') as MissionAbility,
          params: (typeof parsed.params === 'object' && parsed.params !== null
            ? parsed.params
            : {}) as Record<string, Json>,
          expected: typeof parsed.expected === 'string' ? parsed.expected : 'action completed',
        };

      case 'retry':
        return { type: 'retry', reason: typeof parsed.reason === 'string' ? parsed.reason : 'retrying' };

      case 'skip':
        return { type: 'skip', reason: typeof parsed.reason === 'string' ? parsed.reason : 'skipped' };

      case 'abort':
        return { type: 'abort', reason: typeof parsed.reason === 'string' ? parsed.reason : 'aborted' };

      case 'complete':
        return { type: 'complete' };

      case 'think_deeper':
        return { type: 'think_deeper', reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : 'need more context' };

      default:
        return {
          type: 'continue',
          capability: 'read-files' as MissionAbility,
          params: {},
          expected: 'default action',
        };
    }
  }

  // ─── Capability resolution ──────────────────────────────────────────────

  private getAvailableAbilities(): readonly string[] {
    try {
      return this.planner.getAvailableAbilities();
    } catch {
      return ['read-files', 'write-files', 'run-commands', 'list-files', 'install-packages'];
    }
  }

  private resolveCapability(ability: MissionAbility): ResolvedCapability | null {
    try {
      const resolved = this.planner.resolveAbilities([ability]);
      const cap = resolved.length > 0 ? resolved[0] : undefined;
      return cap ?? null;
    } catch {
      return null;
    }
  }

  // ─── Prompts ────────────────────────────────────────────────────────────

  private buildThinkPrompt(step: WorkflowStep, availableAbilities: readonly string[]): string {
    const mem = this.memory;
    const abilities = availableAbilities.length > 0
      ? availableAbilities.join(', ')
      : 'read-files, write-files, run-commands, list-files, install-packages';

    return [
      'You are an autonomous game development engineer. Your mission is to complete a development task.',
      '',
      `Mission goal: ${mem?.goalTitle ?? 'unknown'}`,
      '',
      '## Available capabilities',
      abilities,
      '',
      '## Previous actions',
      ...(mem?.actions ?? []).slice(-5).map((a, i) =>
        `${i + 1}. ${a.decision.type === 'continue' ? a.decision.capability : a.decision.type} — ${a.ok ? 'OK' : 'FAIL'}`,
      ),
      '',
      '## Current step',
      `Title: ${step.title}`,
      `Description: ${step.description}`,
      `Required capability: ${step.requiredCapability ?? 'none'}`,
      '',
      '## Failures',
      ...(mem?.failures ?? []).slice(-3).map((f, i) =>
        `${i + 1}. ${f.action}: ${f.reason} (${f.recovered ? 'recovered' : 'unrecovered'})`,
      ),
      '',
      'Think step by step about what action to take next. Consider:',
      '1. What needs to be done for this step?',
      '2. What capability is most appropriate?',
      '3. What parameters should be passed?',
      '4. What is the expected outcome?',
      '',
      'Respond with a JSON object:',
      '{"reasoning": "...", "intention": "...", "capability": "..."}',
    ].join('\n');
  }

  // ─── Event emission ────────────────────────────────────────────────────

  private async transitionTo(newState: AgentState): Promise<void> {
    if (TERMINAL_STATES.has(this.state)) return;
    this.previousState = this.state;
    this.state = newState;
    const mem = this.memory;
    if (mem) {
      mem.currentState = newState;
    }
    await this.bus.publish(AgentStateChanged, {
      missionId: mem?.missionId ?? '',
      planId: mem?.source.sourceId ?? '',
      previousState: this.previousState,
      currentState: newState,
      timestamp: Date.now(),
    });
  }

  private recordObservation(observation: Observation): void {
    const mem = this.memory;
    if (mem) {
      mem.observations.push(observation);
    }
    void this.bus.publish(AgentObservation, {
      missionId: mem?.missionId ?? '',
      kind: observation.kind,
      content: observation.content,
      timestamp: observation.timestamp,
    });
  }

  private recordThought(thought: Thought): void {
    const mem = this.memory;
    if (mem) {
      mem.thoughts.push(thought);
    }
    void this.bus.publish(AgentThought, {
      missionId: mem?.missionId ?? '',
      reasoning: thought.reasoning,
      intention: thought.intention,
      timestamp: thought.timestamp,
    });
  }

  private recordDecision(decision: Decision): void {
    const mem = this.memory;
    if (mem) {
      mem.decisions.push(decision);
    }
  }

  private recordAction(action: AgentAction): void {
    const mem = this.memory;
    if (mem) {
      mem.actions.push(action);
    }
  }

  private recordVerification(verification: Verification): void {
    const mem = this.memory;
    if (mem) {
      mem.verifications.push(verification);
    }
    void this.bus.publish(AgentVerification, {
      missionId: mem?.missionId ?? '',
      expected: verification.expected,
      observed: verification.observed,
      passed: verification.passed,
      timestamp: verification.timestamp,
    });
  }

  private async emitDecision(decision: Decision): Promise<void> {
    const mem = this.memory;
    const reasoning = decision.type === 'abort' ? decision.reason
      : decision.type === 'think_deeper' ? decision.reasoning
      : decision.type === 'retry' ? decision.reason
      : decision.type === 'skip' ? decision.reason
      : 'proceeding';

    await this.bus.publish(AgentDecisionEvent, {
      missionId: mem?.missionId ?? '',
      decisionType: decision.type,
      capability: decision.type === 'continue' ? decision.capability : null,
      reasoning,
      timestamp: Date.now(),
    });
  }

  private async emitActionStarted(capability: MissionAbility, resolved: ResolvedCapability, params: Record<string, unknown>): Promise<void> {
    const mem = this.memory;
    await this.bus.publish(AgentActionStarted, {
      missionId: mem?.missionId ?? '',
      capability,
      toolId: resolved.toolId,
      action: resolved.capabilityId,
      input: params,
      timestamp: Date.now(),
    });
  }

  private async emitActionResult(capability: MissionAbility, action: AgentAction): Promise<void> {
    const mem = this.memory;
    await this.bus.publish(AgentActionResult, {
      missionId: mem?.missionId ?? '',
      capability,
      ok: action.ok,
      durationMs: action.durationMs,
      output: action.output !== null ? JSON.stringify(action.output) : 'null',
      timestamp: Date.now(),
    });
  }

  private async emitProgress(): Promise<void> {
    const mem = this.memory;
    if (!mem) return;
    const total = mem.source.steps.length;
    const done = mem.actions.filter(a => a.ok).length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    await this.bus.publish(AgentProgress, {
      missionId: mem.missionId ?? '',
      progress,
      actionCount: mem.actions.length,
      failureCount: mem.failures.length,
      timestamp: Date.now(),
    });
  }

  private async emitCompletion(report: MissionReport): Promise<void> {
    await this.bus.publish(AgentMissionComplete, {
      missionId: report.missionId,
      status: report.status,
      finalSummary: report.finalSummary,
      actionCount: report.actionCount,
      totalDurationMs: report.totalDurationMs,
      timestamp: Date.now(),
    });
  }

  // ─── Artifact tracking ──────────────────────────────────────────────────

  private trackArtifacts(capability: MissionAbility, params: Record<string, Json>, _output: string): void {
    const mem = this.memory;
    if (!mem) return;

    if (capability === 'write-files' || capability === 'edit-files') {
      const path = typeof params.path === 'string' ? params.path : 'unknown';
      mem.artifacts.push(path);
      void this.bus.publish(AgentArtifactCreated, {
        missionId: mem.missionId ?? '',
        path,
        kind: 'file',
        timestamp: Date.now(),
      });
    }
    if (capability === 'install-packages') {
      const pkg = typeof params.package === 'string' ? params.package : 'dependencies';
      mem.artifacts.push(`dep:${pkg}`);
      void this.bus.publish(AgentArtifactCreated, {
        missionId: mem.missionId ?? '',
        path: pkg,
        kind: 'dependency',
        timestamp: Date.now(),
      });
    }
  }

  // ─── Report ─────────────────────────────────────────────────────────────

  private buildReport(startTime: number): MissionReport {
    const now = Date.now();
    const mem = this.memory;

    const timeline: Array<{ timestamp: number; state: string; summary: string }> = [];
    timeline.push({ timestamp: startTime, state: 'running', summary: 'Mission started' });
    for (const thought of mem?.thoughts ?? []) {
      timeline.push({
        timestamp: thought.timestamp,
        state: 'thinking',
        summary: thought.intention,
      });
    }
    for (const action of mem?.actions ?? []) {
      timeline.push({
        timestamp: action.timestamp,
        state: 'executing',
        summary: action.ok
          ? `${action.decision.type === 'continue' ? action.decision.capability : action.decision.type} OK`
          : `${action.decision.type === 'continue' ? action.decision.capability : action.decision.type} FAIL`,
      });
    }
    timeline.push({ timestamp: now, state: this.state, summary: `Mission ${this.state}` });

    const actionCount = mem?.actions.length ?? 0;
    const failureCount = mem?.failures.length ?? 0;
    const decisionCount = mem?.decisions.length ?? 0;

    const summary = failureCount > 0
      ? `Mission completed with ${failureCount} failure(s) and ${actionCount} action(s) over ${now - startTime}ms`
      : `Mission completed successfully with ${actionCount} action(s) over ${now - startTime}ms`;

    return {
      missionId: mem?.missionId ?? '',
      planId: mem?.source.sourceId ?? '',
      goalTitle: mem?.goalTitle ?? '',
      startedAt: startTime as Timestamp,
      completedAt: now as Timestamp,
      status: this.state === 'completed' ? 'completed' : this.state === 'cancelled' ? 'cancelled' : 'failed',
      finalSummary: summary,
      timeline,
      actionCount,
      failureCount,
      artifacts: mem?.artifacts ?? [],
      totalDurationMs: now - startTime,
      decisionCount,
    };
  }

  // ─── State checks ──────────────────────────────────────────────────────

  private get isTerminal(): boolean {
    return TERMINAL_STATES.has(this.state);
  }

  private get isCancelled(): boolean {
    if (this.state === 'cancelled') return true;
    if (this.abortSignal?.aborted) {
      this.state = 'cancelled';
      return true;
    }
    return false;
  }
}
