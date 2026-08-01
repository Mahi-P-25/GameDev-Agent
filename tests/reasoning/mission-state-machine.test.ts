import { describe, expect, it } from 'vitest';
import {
  InvalidTransitionError,
  MissionStateMachine,
} from '@gamedev-agent/ami';
import type { MissionFSMEvent, MissionState } from '@gamedev-agent/ami';

/** The full legal transition diagram from the AMI design spec. */
const LEGAL: ReadonlyArray<[MissionState, MissionFSMEvent, MissionState]> = [
  ['created', 'start', 'decomposing'],
  ['decomposing', 'goalTreeReady', 'reasoning'],
  ['reasoning', 'needsApproval', 'paused_approval'],
  ['paused_approval', 'approvalGranted', 'reasoning'],
  ['paused_approval', 'approvalDenied', 'failed'],
  ['reasoning', 'planReady', 'executing'],
  ['executing', 'executionDone', 'verifying'],
  ['verifying', 'verificationDone', 'reflecting'],
  ['reflecting', 'reflectionRetry', 'executing'],
  ['reflecting', 'reflectionContinue', 'reasoning'],
  ['reflecting', 'reflectionReplan', 'decomposing'],
  ['reflecting', 'reflectionFail', 'failed'],
  ['reasoning', 'allGoalsComplete', 'completed'],
];

/** Events that are legal for a given state. */
const EVENTS_FOR: Readonly<Record<MissionState, readonly MissionFSMEvent[]>> = {
  created: ['start', 'cancel'],
  decomposing: ['goalTreeReady', 'cancel'],
  reasoning: ['needsApproval', 'planReady', 'allGoalsComplete', 'cancel'],
  paused_approval: ['approvalGranted', 'approvalDenied', 'cancel'],
  executing: ['executionDone', 'cancel'],
  verifying: ['verificationDone', 'cancel'],
  reflecting: ['reflectionRetry', 'reflectionContinue', 'reflectionReplan', 'reflectionFail', 'cancel'],
  failed: [],
  completed: [],
  canceled: [],
};

const ALL_STATES: ReadonlyArray<MissionState> = [
  'created',
  'decomposing',
  'reasoning',
  'executing',
  'verifying',
  'reflecting',
  'paused_approval',
  'failed',
  'completed',
  'canceled',
];

const ALL_EVENTS: ReadonlyArray<MissionFSMEvent> = [
  'start',
  'goalTreeReady',
  'needsApproval',
  'approvalGranted',
  'approvalDenied',
  'planReady',
  'executionDone',
  'verificationDone',
  'reflectionRetry',
  'reflectionContinue',
  'reflectionReplan',
  'reflectionFail',
  'allGoalsComplete',
  'cancel',
];

function machineAt(state: MissionState): MissionStateMachine {
  const machine = new MissionStateMachine();
  machine.reset(state);
  return machine;
}

describe('MissionStateMachine — legal transitions', () => {
  it.each(LEGAL)('allows %s --%s--> %s', (from, event, to) => {
    const machine = machineAt(from);
    expect(machine.can(event)).toBe(true);
    expect(machine.transition(event)).toBe(to);
    expect(machine.current()).toBe(to);
  });
});

describe('MissionStateMachine — cancel from any active state', () => {
  it.each([
    'created',
    'decomposing',
    'reasoning',
    'paused_approval',
    'executing',
    'verifying',
    'reflecting',
  ] as ReadonlyArray<MissionState>)('allows cancel from %s', (from) => {
    const machine = machineAt(from);
    expect(machine.can('cancel')).toBe(true);
    expect(machine.transition('cancel')).toBe('canceled');
  });

  it.each(['failed', 'completed', 'canceled'] as ReadonlyArray<MissionState>)(
    'rejects cancel from terminal state %s',
    (from) => {
      const machine = machineAt(from);
      expect(machine.can('cancel')).toBe(false);
      expect(() => machine.transition('cancel')).toThrow(InvalidTransitionError);
    },
  );
});

describe('MissionStateMachine — illegal transition rejection', () => {
  // For every state × event pair NOT in the legal diagram, the machine must
  // reject (can() === false and transition() throws InvalidTransitionError).
  it.each(ALL_STATES.flatMap((from) =>
    ALL_EVENTS
      .filter((event) => !EVENTS_FOR[from].includes(event))
      .map((event) => [from, event] as [MissionState, MissionFSMEvent]),
  ))('rejects %s --%s--> (illegal)', (from, event) => {
    const machine = machineAt(from);
    expect(machine.can(event)).toBe(false);
    expect(() => machine.transition(event)).toThrow(InvalidTransitionError);
  });
});

describe('MissionStateMachine — terminal locking', () => {
  it.each([
    ['completed', 'planReady'],
    ['completed', 'reflectionContinue'],
    ['failed', 'reflectionRetry'],
    ['failed', 'start'],
  ] as ReadonlyArray<[MissionState, MissionFSMEvent]>)(
    'locks terminal state %s against %s',
    (from, event) => {
      const machine = machineAt(from);
      expect(() => machine.transition(event)).toThrow(InvalidTransitionError);
    },
  );
});

describe('MissionStateMachine — happy-path walk', () => {
  it('walks a full mission lifecycle to completed', () => {
    const machine = new MissionStateMachine();
    expect(machine.current()).toBe('created');
    expect(machine.transition('start')).toBe('decomposing');
    expect(machine.transition('goalTreeReady')).toBe('reasoning');
    expect(machine.transition('planReady')).toBe('executing');
    expect(machine.transition('executionDone')).toBe('verifying');
    expect(machine.transition('verificationDone')).toBe('reflecting');
    expect(machine.transition('reflectionContinue')).toBe('reasoning');
    expect(machine.transition('allGoalsComplete')).toBe('completed');
  });

  it('walks an approval round-trip', () => {
    const machine = new MissionStateMachine();
    machine.transition('start');
    machine.transition('goalTreeReady');
    expect(machine.transition('needsApproval')).toBe('paused_approval');
    expect(machine.transition('approvalGranted')).toBe('reasoning');
  });

  it('walks an approval denial to failed', () => {
    const machine = new MissionStateMachine();
    machine.transition('start');
    machine.transition('goalTreeReady');
    machine.transition('needsApproval');
    expect(machine.transition('approvalDenied')).toBe('failed');
  });

  it('walks a retry cycle back to executing', () => {
    const machine = new MissionStateMachine();
    machine.transition('start');
    machine.transition('goalTreeReady');
    machine.transition('planReady');
    machine.transition('executionDone');
    machine.transition('verificationDone');
    expect(machine.transition('reflectionRetry')).toBe('executing');
  });

  it('walks a replan cycle back to decomposing', () => {
    const machine = new MissionStateMachine();
    machine.transition('start');
    machine.transition('goalTreeReady');
    machine.transition('planReady');
    machine.transition('executionDone');
    machine.transition('verificationDone');
    expect(machine.transition('reflectionReplan')).toBe('decomposing');
  });
});
