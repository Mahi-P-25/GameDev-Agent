import type { Logger } from '@gamedev-agent/logging';
import { ConsoleLogSink, RootLogger } from '@gamedev-agent/logging';
import type { ToolManager } from './ToolManager';
import type {
  AbilityMapping,
  CapabilityPlannerOptions,
  MissionAbility,
  ResolvedCapability,
  ToolId,
} from './ToolTypes';

/**
 * Built-in mappings from mission abilities to tool capability patterns.
 * These are the default resolution rules for common game-dev operations.
 * The CapabilityPlanner uses them to determine which registered tools
 * can satisfy each ability a mission requires.
 */
const DEFAULT_ABILITY_MAPPINGS: readonly AbilityMapping[] = [
  // Filesystem
  { ability: 'read-files', capabilityPattern: 'files.read', category: 'filesystem' },
  { ability: 'write-files', capabilityPattern: 'files.write', category: 'filesystem' },
  { ability: 'edit-files', capabilityPattern: 'files.write', category: 'filesystem' },
  { ability: 'list-files', capabilityPattern: 'files.list', category: 'filesystem' },
  { ability: 'delete-files', capabilityPattern: 'files.delete', category: 'filesystem' },
  { ability: 'rename-files', capabilityPattern: 'files.rename', category: 'filesystem' },

  // Terminal / Shell
  { ability: 'run-commands', capabilityPattern: 'terminal.run', category: 'shell' },
  { ability: 'run-terminal', capabilityPattern: 'terminal.start', category: 'shell' },
  { ability: 'execute-script', capabilityPattern: 'terminal.run', category: 'shell' },

  // Workspace
  { ability: 'inspect-workspace', capabilityPattern: 'workspace.observe', category: 'filesystem' },

  // Version Control
  { ability: 'version-control-status', capabilityPattern: 'git.status', category: 'vcs' },
  { ability: 'version-control-init', capabilityPattern: 'git.init', category: 'vcs' },
  { ability: 'version-control-commit', capabilityPattern: 'git.commit', category: 'vcs' },
  { ability: 'version-control-branch', capabilityPattern: 'git.branch', category: 'vcs' },
  { ability: 'version-control-diff', capabilityPattern: 'git.diff', category: 'vcs' },

  // Search
  { ability: 'search-files', capabilityPattern: 'search.files', category: 'editor' },
  { ability: 'search-text', capabilityPattern: 'search.text', category: 'editor' },

  // Editor
  { ability: 'open-editor', capabilityPattern: 'workspace.open', category: 'editor' },
  { ability: 'edit-code', capabilityPattern: 'files.write', category: 'editor' },
  { ability: 'open-workspace', capabilityPattern: 'workspace.open', category: 'editor' },
  { ability: 'close-workspace', capabilityPattern: 'workspace.close', category: 'editor' },

  // Browser / Preview
  { ability: 'browse-web', capabilityPattern: 'browser.open', category: 'browser' },
  { ability: 'preview-project', capabilityPattern: 'browser.open', category: 'browser' },

  // 3D / Rendering
  { ability: '3d-model', capabilityPattern: 'blender.model', category: '3d' },
  { ability: 'render-scene', capabilityPattern: 'blender.render', category: '3d' },

  // Build / Test
  { ability: 'build-project', capabilityPattern: 'build.run', category: 'build' },
  { ability: 'test-project', capabilityPattern: 'test.run', category: 'test' },

  // Package Management
  { ability: 'install-packages', capabilityPattern: 'package.install', category: 'shell' },
  { ability: 'remove-packages', capabilityPattern: 'package.remove', category: 'shell' },
];

/**
 * CapabilityPlanner resolves abstract mission abilities to concrete
 * tool capabilities at execution time.
 *
 * The Mission Planner never depends on concrete tool capabilities —
 * it describes what the mission *needs* (read files, run commands, etc.).
 * The CapabilityPlanner maps those needs to specific tools and their
 * capabilities, using the ToolOrchestrator's registry of available tools.
 */
export class CapabilityPlanner {
  private readonly mappings: ReadonlyMap<MissionAbility, readonly AbilityMapping[]>;
  private readonly toolManager: ToolManager;
  private readonly logger: Logger;

  constructor(options: CapabilityPlannerOptions) {
    this.toolManager = options.toolManager;
    this.logger = options.logger ?? new RootLogger('nova.capability-planner', [new ConsoleLogSink()]);
    const allMappings = [
      ...DEFAULT_ABILITY_MAPPINGS,
      ...(options.customMappings ?? []),
    ];
    const grouped = new Map<MissionAbility, AbilityMapping[]>();
    for (const mapping of allMappings) {
      const group = grouped.get(mapping.ability) ?? [];
      group.push(mapping);
      grouped.set(mapping.ability, group);
    }
    const frozen = new Map<MissionAbility, readonly AbilityMapping[]>();
    for (const [ability, list] of grouped) {
      frozen.set(ability, Object.freeze(list));
    }
    this.mappings = frozen;
  }

  /**
   * Resolve a list of mission abilities to concrete tool capabilities.
   * For each ability, finds the best-matching capability from registered tools.
   * Returns one ResolvedCapability per requested ability.
   */
  resolveAbilities(abilities: readonly MissionAbility[]): readonly ResolvedCapability[] {
    const registeredTools = this.toolManager.list();

    const results: ResolvedCapability[] = [];
    const usedCapabilities = new Set<string>();

    for (const ability of abilities) {
      const resolved = this.resolveSingleAbility(ability, registeredTools, usedCapabilities);
      results.push(resolved);
    }

    return results;
  }

  /**
   * List all mission abilities that can be resolved by currently registered tools.
   */
  getAvailableAbilities(): readonly MissionAbility[] {
    const registeredTools = this.toolManager.list();
    const available: MissionAbility[] = [];

    for (const [ability, mappings] of this.mappings) {
      const canResolve = mappings.some((m) =>
        registeredTools.some((tool) =>
          tool.descriptor.capabilities.some((cap) =>
            cap.actions.includes(m.capabilityPattern),
          ),
        ),
      );
      if (canResolve) {
        available.push(ability);
      }
    }

    return available;
  }

  /**
   * Register custom ability-to-capability mappings at runtime.
   * Useful when a new tool is registered that provides novel capabilities.
   */
  registerMapping(mapping: AbilityMapping): void {
    const existing = this.mappings.get(mapping.ability);
    const updated = existing ? [...existing, mapping] : [mapping];
    (this.mappings as Map<MissionAbility, readonly AbilityMapping[]>).set(
      mapping.ability,
      Object.freeze(updated),
    );
  }

  private resolveSingleAbility(
    ability: MissionAbility,
    registeredTools: readonly import('./ToolTypes').ToolRegistration[],
    usedCapabilities: Set<string>,
  ): ResolvedCapability {
    const mappings = this.mappings.get(ability);
    if (mappings === undefined || mappings.length === 0) {
      return this.unresolved(ability);
    }

    // First, try to find an exact-capability match among registered tools
    for (const mapping of mappings) {
      for (const tool of registeredTools) {
        for (const cap of tool.descriptor.capabilities) {
          if (cap.actions.includes(mapping.capabilityPattern)) {
            const capabilityId = `${tool.descriptor.id}.${cap.id}`;
            if (!usedCapabilities.has(capabilityId)) {
              usedCapabilities.add(capabilityId);
              return {
                ability,
                toolId: tool.descriptor.id,
                capabilityId: mapping.capabilityPattern,
                capabilityName: cap.name,
                confidence: 'exact',
                requiresSession: mapping.requiresSession ?? false,
                inputSchema: {},
              };
            }
          }
        }
      }
    }

    // Second pass: allow capability reuse if no fresh match found
    for (const mapping of mappings) {
      for (const tool of registeredTools) {
        for (const cap of tool.descriptor.capabilities) {
          if (cap.actions.includes(mapping.capabilityPattern)) {
            return {
              ability,
              toolId: tool.descriptor.id,
              capabilityId: mapping.capabilityPattern,
              capabilityName: cap.name,
              confidence: 'exact',
              requiresSession: mapping.requiresSession ?? false,
              inputSchema: {},
            };
          }
        }
      }
    }

    // Fallback: no tool can satisfy this ability
    this.logger.warn('capability-planner.unresolved-ability', { ability });
    return this.unresolved(ability);
  }

  private unresolved(ability: MissionAbility): ResolvedCapability {
    return {
      ability,
      toolId: '' as ToolId,
      capabilityId: '',
      capabilityName: '',
      confidence: 'fallback',
      requiresSession: false,
      inputSchema: {},
    };
  }
}

export type { Logger };
