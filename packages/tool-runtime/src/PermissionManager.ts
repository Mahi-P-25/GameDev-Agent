import type { EventBusContract } from '@gamedev-agent/events';
import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { Disposable, UUID } from '@gamedev-agent/shared';
import { ToolPermissionDenied } from './ToolEvents';
import type {
  PermissionCheckResult,
  PermissionManagerOptions,
  PermissionPolicy,
  PermissionPromptRequest,
  PermissionRule,
  ToolActor,
  ToolId,
  ToolPermission,
} from './ToolTypes';

/**
 * PermissionManager — capability-scoped permission enforcement with
 * Allow / Prompt / Deny policy support.
 *
 * Replaces the flat `Set<string>` permission model in ToolManager with
 * a rule-based system where each permission has an explicit policy.
 * Future user policies can be added by registering additional rules.
 */
export class PermissionManager implements Disposable {
  private readonly rules: Map<ToolPermission, PermissionRule>;
  private readonly defaultPolicy: PermissionPolicy;
  private readonly bus: EventBusContract;
  private readonly logger: Logger;
  private readonly onPermissionPrompt:
    | ((request: PermissionPromptRequest) => Promise<boolean>)
    | undefined;
  private disposed = false;

  constructor(bus: EventBusContract, options?: PermissionManagerOptions) {
    this.bus = bus;
    this.logger =
      options?.logger ?? new RootLogger('nova.permission-manager', [new ConsoleLogSink()]);
    this.defaultPolicy = options?.defaultPolicy ?? 'deny';
    this.onPermissionPrompt = options?.onPermissionPrompt;
    this.rules = new Map();

    if (options?.rules !== undefined) {
      for (const rule of options.rules) {
        this.rules.set(rule.permission, rule);
      }
    }
  }

  /**
   * Check whether a permission is granted for the given context.
   * Returns the resolved policy and reason.
   */
  async check(
    permission: ToolPermission,
    toolId: ToolId,
    action: string,
    actor: ToolActor,
    correlationId: UUID | null,
  ): Promise<PermissionCheckResult> {
    const rule = this.rules.get(permission);
    const policy = rule?.policy ?? this.defaultPolicy;

    switch (policy) {
      case 'allow':
        return { granted: true, policy, reason: rule?.reason };

      case 'deny':
        return {
          granted: false,
          policy,
          reason: rule?.reason ?? `permission "${permission}" denied by default policy`,
        };

      case 'prompt': {
        if (this.onPermissionPrompt === undefined) {
          return {
            granted: false,
            policy,
            reason: `permission "${permission}" requires user prompt but no prompt handler is configured`,
          };
        }
        const granted = await this.onPermissionPrompt({
          permission,
          toolId,
          action,
          actor,
          correlationId,
        });
        if (!granted) {
          void this.bus.publish(ToolPermissionDenied, {
            toolId,
            action,
            missing: [permission],
            correlationId: correlationId === null ? null : String(correlationId),
            timestamp: Date.now(),
          });
        }
        return {
          granted,
          policy,
          reason: granted ? 'user granted' : 'user denied',
        };
      }

      default:
        return { granted: false, policy: 'deny', reason: `unknown policy: ${policy}` };
    }
  }

  /**
   * Check multiple permissions. Returns the first denial, or all-granted.
   */
  async checkAll(
    permissions: ReadonlyArray<ToolPermission>,
    toolId: ToolId,
    action: string,
    actor: ToolActor,
    correlationId: UUID | null,
  ): Promise<PermissionCheckResult> {
    for (const permission of permissions) {
      const result = await this.check(permission, toolId, action, actor, correlationId);
      if (!result.granted) {
        return result;
      }
    }
    return { granted: true, policy: 'allow' };
  }

  /**
   * Register or update a permission rule at runtime.
   */
  setRule(rule: PermissionRule): void {
    this.rules.set(rule.permission, rule);
    this.logger.info('permission.rule-set', {
      permission: rule.permission,
      policy: rule.policy,
      reason: rule.reason,
    });
  }

  /**
   * Remove a permission rule, falling back to the default policy.
   */
  removeRule(permission: ToolPermission): void {
    this.rules.delete(permission);
  }

  /**
   * Get the effective policy for a permission.
   */
  getPolicy(permission: ToolPermission): PermissionPolicy {
    return this.rules.get(permission)?.policy ?? this.defaultPolicy;
  }

  /**
   * Get all registered rules.
   */
  getRules(): ReadonlyArray<PermissionRule> {
    return [...this.rules.values()];
  }

  /**
   * Convert to flat granted set for backward compatibility.
   */
  toGrantedSet(): ReadonlySet<string> {
    const granted = new Set<string>();
    for (const [permission, rule] of this.rules) {
      if (rule.policy === 'allow') {
        granted.add(permission);
      }
    }
    return granted;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.rules.clear();
  }
}
