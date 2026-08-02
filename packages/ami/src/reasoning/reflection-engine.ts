import { randomUUID } from 'node:crypto';
import type { IMissionMemoryStore, IReflectionEngine, IRetryStrategyResolver } from './interfaces';
import type { Decision, FailureInfo, MemoryRecord, ReasoningContext, VerificationResult } from './types';

/**
 * Decides what to do after a verification result. Every branch is deterministic
 * and driven by the injected {@link IRetryStrategyResolver} + {@link IMissionMemoryStore}
 * (never hardcoded). This is the single most important decision point in the
 * reasoning cycle, so each branch writes the appropriate memory record and
 * returns a typed {@link Decision}.
 *
 * Semantics:
 *  - `passed`       → write success-pattern → continue (or complete when this
 *                     was the last ready goal, signalled via
 *                     `context.projectContext.remainingReadyGoals`).
 *  - `inconclusive` → escalate to human; never guess.
 *  - `failed`       → write failure → retry / retry_alternate_tool / replan /
 *                     escalate per the resolved RetryPolicy and node attempts.
 *  - `partial`      → identical to `failed` but the memory record is tagged
 *                     `[partial]`.
 */
export class ReflectionEngine implements IReflectionEngine {
  constructor(
    private readonly retryResolver: IRetryStrategyResolver,
    private readonly memory: IMissionMemoryStore,
  ) {}

  async reflect(
    context: ReasoningContext,
    verification: VerificationResult,
  ): Promise<{ readonly decision: Decision; readonly memoryRecord: MemoryRecord | null }> {
    const node = context.node;
    const nextAttempt = node.attempts + 1;

    switch (verification.status) {
      case 'passed': {
        const memoryRecord = this.buildRecord(context, 'success-pattern', `goal ${node.id} verified: ${node.description}`);
        await this.memory.write(memoryRecord);
        const remaining = context.projectContext?.remainingReadyGoals;
        const isLastGoal = typeof remaining === 'number' && remaining <= 1;
        return {
          decision: isLastGoal ? { type: 'complete_mission' } : { type: 'continue_to_next_goal' },
          memoryRecord,
        };
      }

      case 'inconclusive':
        return {
          decision: { type: 'escalate_to_human', reason: 'verification inconclusive; not guessing' },
          memoryRecord: null,
        };

      case 'partial':
      case 'failed': {
        const isPartial = verification.status === 'partial';
        const detail = isPartial
          ? `[partial] goal ${node.id} partially verified: ${verification.strategyResults
              .filter((r) => !r.passed)
              .map((r) => r.strategyKind)
              .join(', ')}`
          : `goal ${node.id} failed verification (${verification.strategyResults.length} strategy results)`;
        const memoryRecord = this.buildRecord(context, 'failure', detail);
        await this.memory.write(memoryRecord);

        const policy = this.retryResolver.resolve(this.capabilityKindOf(context));

        // Replan already attempted once for this node → hand off to a human.
        if (node.status === 'replan') {
          return {
            decision: { type: 'escalate_to_human', reason: 'replan already attempted for this goal' },
            memoryRecord,
          };
        }

        if (nextAttempt < policy.maxAttempts) {
          if (policy.alternateToolAllowed && nextAttempt > 1) {
            return { decision: { type: 'retry_alternate_tool' }, memoryRecord };
          }
          return { decision: { type: 'retry' }, memoryRecord };
        }

        // Retries exhausted. Two or more consecutive failures → replan the goal.
        if (nextAttempt >= policy.escalateAfter) {
          return {
            decision: { type: 'replan_subgoal', reason: `retries exhausted after ${nextAttempt} attempts` },
            memoryRecord,
          };
        }
        return {
          decision: { type: 'replan_subgoal', reason: 'retries exhausted' },
          memoryRecord,
        };
      }
    }
  }

  /** The retry policy is keyed by the capability that failed; falls back to the
   *  default policy when no failure record carries a capability id. */
  private capabilityKindOf(context: ReasoningContext): string {
    const last = context.priorFailures[context.priorFailures.length - 1];
    return last?.capabilityId ?? 'default';
  }

  private buildRecord(
    context: ReasoningContext,
    kind: MemoryRecord['kind'],
    content: string,
  ): MemoryRecord {
    const projectId =
      typeof context.projectContext?.projectId === 'string'
        ? (context.projectContext.projectId as string)
        : 'unknown';
    return {
      id: randomUUID(),
      missionId: context.missionId,
      projectId,
      scope: 'mission',
      kind,
      ...(context.node.id !== undefined ? { goalNodeId: context.node.id } : {}),
      content,
      evidence: { capabilityId: this.capabilityKindOf(context) },
      createdAt: new Date().toISOString(),
    };
  }
}

export type { FailureInfo };
