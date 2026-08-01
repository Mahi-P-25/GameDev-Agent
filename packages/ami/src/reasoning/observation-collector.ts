import { randomUUID } from 'node:crypto';
import type { EventBusContract, EventDefinition } from '@gamedev-agent/events';
import type { Disposable } from '@gamedev-agent/shared';
import type { IObservationCollector } from './interfaces';
import type { Observation } from './types';

// DEVIATION: the Execution Engine's `ExecutionStepCompleted`/`ExecutionStepFailed`
// definitions (packages/execution-engine/src/events.ts) are re-declared here
// with their exact `type` strings. The Event Bus routes subscribers by
// `definition.type`, so these are fully interoperable with the real engine
// events, while keeping the AMI package free of a runtime import cycle with
// execution-engine (execution-engine depends on AMI for IReasoningLoop).
const ExecutionStepCompleted: EventDefinition<ExecutionStepCompletedPayload> = {
  type: 'execution.step-completed',
  version: 1,
};
const ExecutionStepFailed: EventDefinition<ExecutionStepFailedPayload> = {
  type: 'execution.step-failed',
  version: 1,
};

interface ExecutionStepCompletedPayload {
  readonly executionId: string;
  readonly stepId: string;
  readonly attempt: number;
  readonly result: { readonly ok: boolean; readonly error?: string };
  readonly usage: { readonly promptTokens: number; readonly completionTokens: number; readonly totalTokens: number };
  readonly rounds: number;
  readonly totalLatencyMs: number;
  readonly timestamp: number;
}

interface ExecutionStepFailedPayload {
  readonly executionId: string;
  readonly stepId: string;
  readonly attempt: number;
  readonly error: string;
  readonly code: string;
  readonly timestamp: number;
}

/**
 * Subscribes to the EXISTING Execution Engine's completion events
 * (`execution.step-completed` / `execution.step-failed`) and normalizes their
 * payloads into the AMI {@link Observation} shape. Normalization is
 * straightforward field-mapping only — no business logic lives here. Events are
 * captured while attached; `attach()` returns a disposable so subscribers are
 * never leaked.
 */
export class ObservationCollector implements IObservationCollector {
  private attached = false;
  private readonly disposables: Disposable[] = [];
  private readonly observations = new Map<string, Observation>();
  private lastObservation: Observation | null = null;

  constructor(private readonly bus: EventBusContract) {}

  attach(): Disposable {
    if (this.attached) {
      return { dispose: () => {} };
    }
    this.attached = true;
    this.disposables.push(
      this.bus.subscribe(ExecutionStepCompleted, (e) => this.onCompleted(e.payload)),
      this.bus.subscribe(ExecutionStepFailed, (e) => this.onFailed(e.payload)),
    );
    return {
      dispose: () => {
        for (const d of this.disposables.splice(0)) d.dispose();
        this.attached = false;
      },
    };
  }

  collect(stepPlanId: string, toolSelectionId: string): Observation | null {
    const latest = this.lastObservation;
    if (latest === null) return null;
    return { ...latest, stepPlanId, toolSelectionId };
  }

  latest(): Observation | null {
    return this.lastObservation;
  }

  private onCompleted(payload: ExecutionStepCompletedPayload): void {
    const observation: Observation = {
      id: randomUUID(),
      stepPlanId: payload.stepId,
      toolSelectionId: payload.stepId,
      rawResult: payload,
      normalizedPayload: {
        stepId: payload.stepId,
        executionId: payload.executionId,
        ok: payload.result.ok,
        result: payload.result,
        rounds: payload.rounds,
        totalLatencyMs: payload.totalLatencyMs,
        usage: payload.usage,
      },
      success: payload.result.ok,
      errors: payload.result.ok ? [] : [payload.result.error ?? 'unknown error'],
    };
    this.record(observation);
  }

  private onFailed(payload: ExecutionStepFailedPayload): void {
    const observation: Observation = {
      id: randomUUID(),
      stepPlanId: payload.stepId,
      toolSelectionId: payload.stepId,
      rawResult: payload,
      normalizedPayload: {
        stepId: payload.stepId,
        executionId: payload.executionId,
        error: payload.error,
        code: payload.code,
      },
      success: false,
      errors: [payload.error],
    };
    this.record(observation);
  }

  private record(observation: Observation): void {
    this.lastObservation = observation;
    this.observations.set(observation.id, observation);
  }
}
