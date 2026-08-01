import type { StepPlan } from '../reasoning/types';

/**
 * A single approval rule: a labelled predicate over a {@link StepPlan}. The
 * default policy is a *list* of these (injectable/overridable) — never an
 * if/else chain, so rules can be added, removed, or replaced without editing
 * this class (Open/Closed).
 */
export interface ApprovalRule {
  readonly label: string;
  readonly predicate: (plan: StepPlan) => boolean;
}

export interface ApprovalPolicyOptions {
  /** Directory considered safe for filesystem writes. Defaults to `.nova/scratch`. */
  readonly scratchDir?: string;
  /**
   * Replacement rule set. When omitted, the built-in defaults below are used.
   * Supplying this overrides defaults entirely.
   */
  readonly rules?: ReadonlyArray<ApprovalRule>;
  /** Additional rules appended after the (default or overridden) rule set. */
  readonly customRules?: ReadonlyArray<ApprovalRule>;
}

function isGitOperation(plan: StepPlan): boolean {
  return plan.requiredCapabilityKind.includes('git') || plan.requiredCapabilityKind === 'version-control';
}

/**
 * Plain data/config class holding the approval rule set. Default rules cover
 * the high-risk operations from the AMI design spec:
 *  - destructive filesystem ops outside the scratch directory
 *  - git push / force-push / history-rewrite
 *  - explicitly escalated steps
 *  - high-impact steps
 *  - large-scope replans
 */
export class ApprovalPolicy {
  private readonly rules: ReadonlyArray<ApprovalRule>;
  private readonly scratchDir: string;

  constructor(options: ApprovalPolicyOptions = {}) {
    this.scratchDir = options.scratchDir ?? '.nova/scratch';
    this.rules = [...(options.rules ?? this.defaultRules()), ...(options.customRules ?? [])];
  }

  requiresApproval(plan: StepPlan): boolean {
    return this.reasons(plan).length > 0;
  }

  /** Human-readable reasons why a plan requires approval (empty when it does not). */
  reasons(plan: StepPlan): string[] {
    const matched: string[] = [];
    for (const rule of this.rules) {
      if (rule.predicate(plan)) {
        matched.push(rule.label);
      }
    }
    return matched;
  }

  private defaultRules(): ReadonlyArray<ApprovalRule> {
    return [
      {
        label: 'destructive filesystem operation outside scratch dir',
        predicate: (plan) => {
          const isDestructive =
            plan.requiredCapabilityKind === 'delete-files' ||
            plan.requiredCapabilityKind === 'rename-files' ||
            plan.params.recursive === true ||
            plan.params.op === 'delete';
          if (!isDestructive) return false;
          const path = typeof plan.params.path === 'string' ? plan.params.path : '';
          return !path.startsWith(this.scratchDir);
        },
      },
      {
        label: 'git push / force-push / history rewrite',
        predicate: (plan) => {
          if (!isGitOperation(plan)) return false;
          const command = String(plan.params.command ?? '');
          return (
            command === 'push' ||
            command === 'force-push' ||
            plan.params.force === true ||
            plan.params.rewriteHistory === true ||
            command.includes('rebase') ||
            command.includes('reset --hard')
          );
        },
      },
      {
        label: 'escalated step',
        predicate: (plan) => plan.params.escalated === true || plan.params.risk === 'high',
      },
      {
        label: 'high-impact step',
        predicate: (plan) => plan.highImpact === true || plan.requiresApproval === true,
      },
      {
        label: 'large-scope replan',
        predicate: (plan) =>
          plan.params.scope === 'large' ||
          (typeof plan.params.goalCount === 'number' && (plan.params.goalCount as number) >= 5),
      },
    ];
  }
}
