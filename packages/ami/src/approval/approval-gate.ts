import type { EventBusContract } from '@gamedev-agent/events';
import type { IApprovalGate } from '../reasoning/interfaces';
import type { ApprovalRequest, ApprovalResponse, StepPlan } from '../reasoning/types';
import {
  ReasoningApprovalRequested,
  ReasoningApprovalResolved,
} from '../reasoning/reasoning-events';
import { ApprovalPolicy } from './approval-policy';

/** Thrown when an approval request times out with no matching response. */
export class ApprovalTimeoutError extends Error {
  constructor(
    readonly requestId: string,
    readonly timeoutMs: number,
  ) {
    super(`Approval request ${requestId} timed out after ${timeoutMs}ms`);
    this.name = 'ApprovalTimeoutError';
  }
}

export interface ApprovalGateOptions {
  readonly policy: ApprovalPolicy;
  readonly bus: EventBusContract;
  readonly timeoutMs?: number;
}

/**
 * Gates high-risk step plans behind human approval. `requestApproval` publishes
 * the existing `mission.reasoning.approval.requested` event, subscribes to
 * `mission.reasoning.approval.resolved`, resolves on a response matching the
 * request id, and always disposes the subscription (no leak). A timeout rejects
 * with {@link ApprovalTimeoutError} so the reasoning loop never hangs forever.
 */
export class ApprovalGate implements IApprovalGate {
  private readonly policy: ApprovalPolicy;
  private readonly bus: EventBusContract;
  private readonly timeoutMs: number;

  constructor(options: ApprovalGateOptions) {
    this.policy = options.policy;
    this.bus = options.bus;
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  requiresApproval(stepPlan: StepPlan): boolean {
    return this.policy.requiresApproval(stepPlan);
  }

  requestApproval(request: ApprovalRequest): Promise<ApprovalResponse> {
    return new Promise<ApprovalResponse>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const subscription = this.bus.subscribe(ReasoningApprovalResolved, (envelope) => {
        if (envelope.payload.response.requestId !== request.id) {
          return;
        }
        if (timer !== undefined) clearTimeout(timer);
        subscription.dispose();
        resolve(envelope.payload.response);
      });

      timer = setTimeout(() => {
        subscription.dispose();
        reject(new ApprovalTimeoutError(request.id, this.timeoutMs));
      }, this.timeoutMs);

      void this.bus
        .publish(ReasoningApprovalRequested, {
          missionId: request.missionId,
          request,
          timestamp: Date.now(),
        })
        .catch((error) => {
          if (timer !== undefined) clearTimeout(timer);
          subscription.dispose();
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
  }
}
