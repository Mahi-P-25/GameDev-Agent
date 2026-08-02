import type { MissionFSMEvent, MissionState } from './types';
import type { IMissionStateMachine } from './interfaces';

/**
 * Thrown when a state machine transition is not allowed by the transition
 * table. Illegal transitions are never silently ignored.
 */
export class InvalidTransitionError extends Error {
  constructor(
    readonly from: MissionState,
    readonly event: MissionFSMEvent,
  ) {
    super(`Illegal transition: ${from} --${event}--> ?`);
    this.name = 'InvalidTransitionError';
  }
}

/**
 * Explicit transition table: `{ [state]: { [event]: nextState } }`. There is no
 * if/else chain anywhere in the machine — legality is purely a table lookup.
 */
const TRANSITIONS: Readonly<Record<MissionState, Partial<Record<MissionFSMEvent, MissionState>>>> = {
  created: { start: 'decomposing' },
  decomposing: { goalTreeReady: 'reasoning' },
  reasoning: {
    needsApproval: 'paused_approval',
    planReady: 'executing',
    allGoalsComplete: 'completed',
  },
  paused_approval: {
    approvalGranted: 'reasoning',
    approvalDenied: 'failed',
  },
  executing: { executionDone: 'verifying' },
  verifying: { verificationDone: 'reflecting' },
  reflecting: {
    reflectionRetry: 'executing',
    reflectionContinue: 'reasoning',
    reflectionReplan: 'decomposing',
    reflectionFail: 'failed',
  },
  failed: {},
  completed: {},
  canceled: {},
};

/** Every state may cancel into `canceled`. */
const CANCELABLE: Readonly<Record<MissionState, boolean>> = {
  created: true,
  decomposing: true,
  reasoning: true,
  paused_approval: true,
  executing: true,
  verifying: true,
  reflecting: true,
  failed: false,
  completed: false,
  canceled: false,
};

/**
 * Mission lifecycle state machine for the reasoning loop. Built around an
 * explicit transition table (a `Map`/object literal), not a chain of if/else.
 * Illegal transitions throw {@link InvalidTransitionError}.
 */
export class MissionStateMachine implements IMissionStateMachine {
  private state: MissionState = 'created';

  current(): MissionState {
    return this.state;
  }

  can(event: MissionFSMEvent): boolean {
    if (event === 'cancel') {
      return CANCELABLE[this.state];
    }
    return TRANSITIONS[this.state][event] !== undefined;
  }

  transition(event: MissionFSMEvent): MissionState {
    let next: MissionState;
    if (event === 'cancel') {
      if (!CANCELABLE[this.state]) {
        throw new InvalidTransitionError(this.state, event);
      }
      next = 'canceled';
    } else {
      const candidate = TRANSITIONS[this.state][event];
      if (candidate === undefined) {
        throw new InvalidTransitionError(this.state, event);
      }
      next = candidate;
    }
    this.state = next;
    return next;
  }

  reset(initial: MissionState = 'created'): void {
    this.state = initial;
  }
}
