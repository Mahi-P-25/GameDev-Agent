import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import type { Json, Timestamp } from '@gamedev-agent/shared';
import type { MemoryManager, MemoryEntryInput } from '@gamedev-agent/memory';
import type { IMissionMemoryStore, MemoryRecord } from '@gamedev-agent/ami';
import type { MissionReport, ShortTermMemory } from './MissionAgentTypes';
import {
  MissionMemoryRetrieved,
  MissionMemoryRecorded,
  MissionMemoryPersisted,
} from './MissionMemoryEvents';

// ─── Public types ──────────────────────────────────────────────────────────

/**
 * Structured context assembled from prior memories, delivered to MissionAgent
 * before execution so the LLM prompt includes prior knowledge.
 */
export interface MissionMemoryContext {
  /** Summaries from prior missions in the same project. */
  readonly priorMissions: ReadonlyArray<{
    readonly missionId: string;
    readonly goalTitle: string;
    readonly status: string;
    readonly summary: string;
  }>;
  /** Project-level knowledge: frameworks, dependencies, conventions. */
  readonly projectContext: ReadonlyArray<{
    readonly category: string;
    readonly summary: string;
    readonly content: Json;
  }>;
  /** Agent strategies from prior missions: what worked, what didn't. */
  readonly agentStrategies: ReadonlyArray<{
    readonly summary: string;
    readonly content: Json;
  }>;
  /** Recent failure patterns to avoid repeating. */
  readonly failurePatterns: ReadonlyArray<{
    readonly action: string;
    readonly reason: string;
  }>;
  /** Pre-rendered string for prompt injection. */
  readonly promptSummary: string;
}

// ─── Integration service ───────────────────────────────────────────────────

/**
 * Bridges MissionAgent's lifecycle into the persistent memory subsystem.
 *
 * Three hooks:
 *  1. `retrieveRelevantMemories` — before execution
 *  2. `recordMissionEvent` — during execution
 *  3. `persistMissionSummary` — after completion
 *
 * All writes go through the existing `MemoryManager.storeEntry()` (packages/memory)
 * and optionally through `IMissionMemoryStore.write()` (packages/ami) so both the
 * tiered memory system and the AMI reasoning loop see the same records.
 */
export class MissionMemoryIntegration {
  private readonly memoryManager: MemoryManager;
  private readonly missionMemoryStore: IMissionMemoryStore | null;
  private readonly bus: EventBusContract;
  private readonly logger: Logger;

  constructor(options: {
    readonly memoryManager: MemoryManager;
    readonly missionMemoryStore?: IMissionMemoryStore;
    readonly eventBus: EventBusContract;
    readonly logger: Logger;
  }) {
    this.memoryManager = options.memoryManager;
    this.missionMemoryStore = options.missionMemoryStore ?? null;
    this.bus = options.eventBus;
    this.logger = options.logger;
  }

  // ─── Hook 1: Before execution ──────────────────────────────────────────

  /**
   * Retrieve relevant memories from prior missions for the same project.
   * Returns a structured context that MissionAgent injects into the LLM prompt.
   */
  async retrieveRelevantMemories(
    missionId: string,
    projectId: string,
    _goalTitle: string,
  ): Promise<MissionMemoryContext> {
    const namespace = `project/${projectId}`;

    try {
      // Query prior mission execution memories
      const priorMissionEntries = await this.memoryManager.query({
        namespace,
        category: 'execution',
        tags: ['mission'],
        sortBy: 'createdAt',
        sortDirection: 'desc',
        limit: 10,
      });

      // Query project-level context memories
      const projectContextEntries = await this.memoryManager.query({
        namespace,
        category: 'code',
        tags: ['project-context'],
        sortBy: 'createdAt',
        sortDirection: 'desc',
        limit: 5,
      });

      // Query agent strategy patterns
      const agentStrategyEntries = await this.memoryManager.query({
        namespace,
        category: 'pattern',
        tags: ['agent-strategy'],
        sortBy: 'createdAt',
        sortDirection: 'desc',
        limit: 5,
      });

      const priorMissions = priorMissionEntries.map((entry) => {
        const content = entry.content as Record<string, unknown>;
        return {
          missionId: typeof content.missionId === 'string' ? content.missionId : entry.id,
          goalTitle: typeof content.goalTitle === 'string' ? content.goalTitle : entry.summary,
          status: typeof content.status === 'string' ? content.status : 'unknown',
          summary: entry.summary,
        };
      });

      const projectContext = projectContextEntries.map((entry) => ({
        category: entry.category,
        summary: entry.summary,
        content: entry.content,
      }));

      const agentStrategies = agentStrategyEntries.map((entry) => ({
        summary: entry.summary,
        content: entry.content,
      }));

      // Extract failure patterns from prior missions
      const failurePatterns: Array<{ action: string; reason: string }> = [];
      for (const entry of priorMissionEntries) {
        const content = entry.content as Record<string, unknown>;
        const failures = content.failedSteps;
        if (Array.isArray(failures)) {
          for (const failure of failures) {
            if (
              typeof failure === 'object' &&
              failure !== null &&
              typeof (failure as Record<string, unknown>).action === 'string' &&
              typeof (failure as Record<string, unknown>).reason === 'string'
            ) {
              failurePatterns.push({
                action: (failure as Record<string, unknown>).action as string,
                reason: (failure as Record<string, unknown>).reason as string,
              });
            }
          }
        }
      }

      const promptSummary = this.buildPromptSummary(
        priorMissions,
        projectContext,
        agentStrategies,
        failurePatterns,
      );

      const context: MissionMemoryContext = {
        priorMissions,
        projectContext,
        agentStrategies,
        failurePatterns: failurePatterns.slice(0, 10),
        promptSummary,
      };

      this.logger.info('mission.memory.retrieved', {
        missionId,
        projectId,
        priorMissions: priorMissions.length,
        projectContext: projectContext.length,
        agentStrategies: agentStrategies.length,
        failurePatterns: failurePatterns.length,
      });

      await this.bus.publish(MissionMemoryRetrieved, {
        missionId,
        projectId,
        priorMissionCount: priorMissions.length,
        projectMemoryCount: projectContext.length,
        agentStrategyCount: agentStrategies.length,
        timestamp: Date.now(),
      });

      return context;
    } catch (error) {
      this.logger.warn('mission.memory.retrieval-failed', {
        missionId,
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Return empty context on failure — memory retrieval is non-blocking
      return {
        priorMissions: [],
        projectContext: [],
        agentStrategies: [],
        failurePatterns: [],
        promptSummary: '',
      };
    }
  }

  // ─── Hook 2: During execution ──────────────────────────────────────────

  /**
   * Record a significant mission event to persistent memory during execution.
   * Non-blocking — failures are logged but never propagate to the mission loop.
   */
  async recordMissionEvent(
    missionId: string,
    projectId: string,
    event: {
      readonly kind: 'action-completed' | 'action-failed' | 'step-verified' | 'step-failed';
      readonly summary: string;
      readonly details: Record<string, unknown>;
    },
  ): Promise<void> {
    try {
      const entry: MemoryEntryInput = {
        tier: 'session',
        namespace: `project/${projectId}`,
        category: 'execution',
        summary: `[${event.kind}] ${event.summary}`,
        content: {
          missionId,
          kind: event.kind,
          ...event.details,
          recordedAt: new Date().toISOString(),
        } as Json,
        tags: ['mission', `mission:${missionId}`, 'in-flight'],
        provenance: {
          source: 'mission-agent',
          timestamp: Date.now() as Timestamp,
          actor: 'mission-agent',
          missionId,
        },
        confidence: 'medium',
      };

      await this.memoryManager.storeEntry(entry);

      // Bridge to AMI mission memory store if available
      if (this.missionMemoryStore !== null) {
        const record: MemoryRecord = {
          id: `${missionId}-${Date.now()}`,
          missionId,
          projectId,
          scope: 'mission',
          kind: event.kind.includes('failed') ? 'failure' : 'fact',
          content: `${event.summary}: ${JSON.stringify(event.details)}`,
          evidence: event.details,
          createdAt: new Date().toISOString(),
        };
        await this.missionMemoryStore.write(record);
      }

      await this.bus.publish(MissionMemoryRecorded, {
        missionId,
        projectId,
        category: 'execution',
        tier: 'session',
        summary: event.summary,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.warn('mission.memory.record-failed', {
        missionId,
        kind: event.kind,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ─── Hook 3: After completion ──────────────────────────────────────────

  /**
   * Persist three structured memory entries after mission completion:
   *   1. Mission Memory (session tier) — execution trace
   *   2. Project Memory (project tier) — inferred project context
   *   3. Agent Memory (project tier) — reasoning patterns / strategies
   */
  async persistMissionSummary(
    missionId: string,
    projectId: string,
    report: MissionReport,
    memory: ShortTermMemory | null,
  ): Promise<void> {
    if (memory === null) {
      this.logger.warn('mission.memory.persist-skipped', {
        missionId,
        reason: 'no short-term memory available',
      });
      return;
    }

    let missionStored = false;
    let projectStored = false;
    let agentStored = false;
    let totalEntries = 0;

    const namespace = `project/${projectId}`;
    const now = Date.now() as Timestamp;

    try {
      // ── 1. Mission Memory ──────────────────────────────────────────────
      const completedSteps = memory.actions
        .filter((a) => a.ok)
        .map((a) => ({
          capability: a.decision.type === 'continue' ? a.decision.capability : a.decision.type,
          timestamp: a.timestamp,
          durationMs: a.durationMs,
        }));

      const failedSteps = memory.failures.map((f) => ({
        action: f.action,
        reason: f.reason,
        recovered: f.recovered,
      }));

      const toolCalls = memory.actions
        .filter((a) => a.decision.type === 'continue')
        .map((a) => ({
          capability: a.decision.type === 'continue' ? a.decision.capability : 'unknown',
          ok: a.ok,
          durationMs: a.durationMs,
        }));

      const missionEntry: MemoryEntryInput = {
        tier: 'session',
        namespace,
        category: 'execution',
        summary: `Mission "${report.goalTitle}" ${report.status} — ${report.actionCount} actions, ${report.failureCount} failures`,
        content: {
          missionId,
          goalTitle: report.goalTitle,
          status: report.status,
          startedAt: report.startedAt,
          completedAt: report.completedAt,
          completedSteps,
          failedSteps,
          toolCalls,
          generatedFiles: [...memory.artifacts],
          totalDurationMs: report.totalDurationMs,
          decisionCount: report.decisionCount,
        } as Json,
        tags: ['mission', `mission:${missionId}`],
        provenance: {
          source: 'mission-agent',
          timestamp: now,
          actor: 'mission-agent',
          missionId,
        },
        confidence: report.status === 'completed' ? 'high' : 'medium',
      };

      await this.memoryManager.storeEntry(missionEntry);
      missionStored = true;
      totalEntries++;

      // ── 2. Project Memory ──────────────────────────────────────────────
      const projectMemoryContent = this.extractProjectContext(memory);
      if (projectMemoryContent !== null) {
        const projectEntry: MemoryEntryInput = {
          tier: 'project',
          namespace,
          category: 'code',
          summary: `Project context from mission "${report.goalTitle}"`,
          content: projectMemoryContent as Json,
          tags: ['project-context', `mission:${missionId}`],
          provenance: {
            source: 'mission-agent',
            timestamp: now,
            actor: 'mission-agent',
            missionId,
          },
          confidence: 'medium',
        };

        await this.memoryManager.storeEntry(projectEntry);
        projectStored = true;
        totalEntries++;
      }

      // ── 3. Agent Memory ────────────────────────────────────────────────
      const agentMemoryContent = this.extractAgentStrategies(memory, report);
      const agentEntry: MemoryEntryInput = {
        tier: 'project',
        namespace,
        category: 'pattern',
        summary: `Agent strategies from mission "${report.goalTitle}"`,
        content: agentMemoryContent as Json,
        tags: ['agent-strategy', `mission:${missionId}`],
        provenance: {
          source: 'mission-agent',
          timestamp: now,
          actor: 'mission-agent',
          missionId,
        },
        confidence: report.status === 'completed' ? 'high' : 'low',
      };

      await this.memoryManager.storeEntry(agentEntry);
      agentStored = true;
      totalEntries++;

      // Bridge summary to AMI mission memory store
      if (this.missionMemoryStore !== null) {
        const summaryRecord: MemoryRecord = {
          id: `${missionId}-summary`,
          missionId,
          projectId,
          scope: 'mission',
          kind: report.status === 'completed' ? 'success-pattern' : 'failure',
          content: `Mission "${report.goalTitle}" ${report.status}: ${report.finalSummary}`,
          evidence: {
            actionCount: report.actionCount,
            failureCount: report.failureCount,
            totalDurationMs: report.totalDurationMs,
          },
          createdAt: new Date().toISOString(),
        };
        await this.missionMemoryStore.write(summaryRecord);
      }

      this.logger.info('mission.memory.persisted', {
        missionId,
        projectId,
        missionStored,
        projectStored,
        agentStored,
        totalEntries,
      });

      await this.bus.publish(MissionMemoryPersisted, {
        missionId,
        projectId,
        missionMemoryStored: missionStored,
        projectMemoryStored: projectStored,
        agentMemoryStored: agentStored,
        totalEntriesStored: totalEntries,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error('mission.memory.persist-failed', {
        missionId,
        projectId,
        missionStored,
        projectStored,
        agentStored,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /**
   * Extract project-level context from the mission's short-term memory:
   * frameworks inferred from tool calls, dependencies installed, files touched.
   */
  private extractProjectContext(
    memory: ShortTermMemory,
  ): Record<string, unknown> | null {
    const dependenciesUsed: string[] = [];
    const filesWritten: string[] = [];
    const foldersAccessed = new Set<string>();
    const frameworksDetected: string[] = [];

    for (const action of memory.actions) {
      if (action.decision.type !== 'continue') continue;

      const params = action.decision.params as Record<string, Json>;

      if (action.decision.capability === 'install-packages') {
        const pkg = typeof params.package === 'string' ? params.package : null;
        if (pkg !== null && !dependenciesUsed.includes(pkg)) {
          dependenciesUsed.push(pkg);
          // Infer frameworks from packages
          if (pkg.includes('react')) frameworksDetected.push('React');
          if (pkg.includes('unity')) frameworksDetected.push('Unity');
          if (pkg.includes('godot')) frameworksDetected.push('Godot');
          if (pkg.includes('phaser')) frameworksDetected.push('Phaser');
          if (pkg.includes('three')) frameworksDetected.push('Three.js');
          if (pkg.includes('pixi')) frameworksDetected.push('PixiJS');
        }
      }

      if (action.decision.capability === 'write-files' || action.decision.capability === 'edit-files') {
        const path = typeof params.path === 'string' ? params.path : null;
        if (path !== null) {
          filesWritten.push(path);
          const folder = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '.';
          foldersAccessed.add(folder);
        }
      }

      if (action.decision.capability === 'read-files' || action.decision.capability === 'list-files') {
        const path = typeof params.path === 'string' ? params.path : null;
        if (path !== null) {
          const folder = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : path;
          foldersAccessed.add(folder);
        }
      }
    }

    // Only produce project memory if there's meaningful content
    if (dependenciesUsed.length === 0 && filesWritten.length === 0 && foldersAccessed.size === 0) {
      return null;
    }

    return {
      projectId: memory.projectId,
      frameworksDetected: [...new Set(frameworksDetected)],
      dependenciesUsed,
      foldersAccessed: [...foldersAccessed],
      importantFiles: filesWritten,
      conventions: this.inferConventions(filesWritten),
    };
  }

  /**
   * Infer coding conventions from the files that were written or edited.
   */
  private inferConventions(filesWritten: string[]): string[] {
    const conventions: string[] = [];
    const extensions = filesWritten.map((f) => {
      const dot = f.lastIndexOf('.');
      return dot >= 0 ? f.substring(dot) : '';
    });

    if (extensions.includes('.ts') || extensions.includes('.tsx')) {
      conventions.push('TypeScript');
    }
    if (extensions.includes('.js') || extensions.includes('.jsx')) {
      conventions.push('JavaScript');
    }
    if (extensions.includes('.py')) {
      conventions.push('Python');
    }
    if (extensions.includes('.cs')) {
      conventions.push('C#');
    }
    if (extensions.includes('.gd')) {
      conventions.push('GDScript');
    }

    if (filesWritten.some((f) => f.includes('src/'))) {
      conventions.push('src/ directory structure');
    }
    if (filesWritten.some((f) => f.includes('test') || f.includes('spec'))) {
      conventions.push('co-located tests');
    }

    return conventions;
  }

  /**
   * Extract agent strategy patterns from the mission execution trace:
   * reasoning, reflections, failures, retries, successful strategies.
   */
  private extractAgentStrategies(
    memory: ShortTermMemory,
    report: MissionReport,
  ): Record<string, unknown> {
    const reasoning = memory.thoughts.map((t) => ({
      reasoning: t.reasoning,
      intention: t.intention,
    }));

    const reflections = memory.verifications.map((v) => ({
      expected: v.expected,
      observed: v.observed,
      passed: v.passed,
    }));

    const failures = memory.failures.map((f) => ({
      action: f.action,
      reason: f.reason,
      recovered: f.recovered,
    }));

    const successfulStrategies = memory.actions
      .filter((a) => a.ok && a.decision.type === 'continue')
      .map((a) => ({
        capability: a.decision.type === 'continue' ? a.decision.capability : 'unknown',
        durationMs: a.durationMs,
      }));

    const retries = memory.failures.filter((f) => f.recovered).length;

    return {
      reasoning: reasoning.slice(-10),
      reflections: reflections.slice(-10),
      failures,
      retries,
      successfulStrategies: successfulStrategies.slice(-10),
      totalActions: report.actionCount,
      totalDecisions: report.decisionCount,
      outcome: report.status,
    };
  }

  /**
   * Build a human-readable summary for LLM prompt injection from retrieved memories.
   */
  private buildPromptSummary(
    priorMissions: ReadonlyArray<{ missionId: string; goalTitle: string; status: string; summary: string }>,
    projectContext: ReadonlyArray<{ category: string; summary: string; content: Json }>,
    agentStrategies: ReadonlyArray<{ summary: string; content: Json }>,
    failurePatterns: ReadonlyArray<{ action: string; reason: string }>,
  ): string {
    const lines: string[] = [];

    if (priorMissions.length > 0) {
      lines.push('### Prior Missions');
      for (const m of priorMissions.slice(0, 5)) {
        lines.push(`- ${m.goalTitle} [${m.status}]: ${m.summary}`);
      }
      lines.push('');
    }

    if (projectContext.length > 0) {
      lines.push('### Project Knowledge');
      for (const p of projectContext.slice(0, 3)) {
        lines.push(`- ${p.summary}`);
      }
      lines.push('');
    }

    if (agentStrategies.length > 0) {
      lines.push('### What Worked Before');
      for (const s of agentStrategies.slice(0, 3)) {
        lines.push(`- ${s.summary}`);
      }
      lines.push('');
    }

    if (failurePatterns.length > 0) {
      lines.push('### Known Failure Patterns (avoid these)');
      for (const f of failurePatterns.slice(0, 5)) {
        lines.push(`- ${f.action}: ${f.reason}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
