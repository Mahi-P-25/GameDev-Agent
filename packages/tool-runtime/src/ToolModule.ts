import { CAPABILITY_MANAGER_TOKEN } from '@gamedev-agent/capabilities';
import type {
  CapabilityDescriptor,
  CapabilityHealth,
  CapabilityManager,
} from '@gamedev-agent/capabilities';
import {
  BaseCapability,
  CapabilityExecutionError,
  asCapabilityId,
} from '@gamedev-agent/capabilities';
import { COORDINATOR_MANAGER_TOKEN } from '@gamedev-agent/coordinator';
import type { CoordinatorManager } from '@gamedev-agent/coordinator';
import type { StudioKernel } from '@gamedev-agent/kernel';
import type { Json, UUID } from '@gamedev-agent/shared';
import type { ToolManager } from './ToolManager';
import { ToolManager as Manager } from './ToolManager';
import type { ToolInvocationResult } from './ToolTypes';
import type {
  CapabilitiesLink,
  CapabilityDescriptorLike,
  CoordinatorLink,
  ToolId,
} from './ToolTypes';
import { TOOL_RUNTIME_TOKEN } from './ToolTypes';

/**
 * A capability adapter that surfaces a registered tool on the Capability
 * framework so the Studio API can discover and invoke it. It is a thin proxy:
 * `run` forwards to the live {@link ToolManager.invoke}, and `probe` reports the
 * tool's current runtime health. The tool itself is never modified — this is
 * the read-only advertise seam the runtime promised.
 *
 * A tool is surfaced as a single capability whose `execute` input carries the
 * concrete `action` plus its `params`, so all of the tool's actions remain
 * reachable through the capability surface.
 */
class ToolCapability extends BaseCapability {
  constructor(
    descriptor: CapabilityDescriptor,
    private readonly delegate: (request: {
      toolId: string;
      action: string;
      input: Json;
      correlationId: string | null;
    }) => Promise<ToolInvocationResult>,
    private readonly healthOf: () => Promise<CapabilityHealth>,
  ) {
    super(descriptor);
  }

  protected override async run(
    context: import('@gamedev-agent/capabilities').CapabilityContext,
  ): Promise<Json> {
    const input = (context.input ?? {}) as { action?: unknown; params?: Json };
    const action = typeof input.action === 'string' ? input.action : '';
    const result = await this.delegate({
      toolId: this.descriptor.id,
      action,
      input: (input.params ?? null) as Json,
      correlationId: context.correlationId,
    });
    if (!result.ok) {
      throw new CapabilityExecutionError(
        this.descriptor.id,
        result.error?.code ?? 'tool-failed',
        result.error?.message ?? 'tool invocation failed',
      );
    }
    return result.output ?? null;
  }

  protected override async probe(): Promise<CapabilityHealth> {
    return this.healthOf();
  }
}

/** Build a {@link CapabilityDescriptor} from the runtime's structural descriptor. */
function toCapabilityDescriptor(tool: CapabilityDescriptorLike): CapabilityDescriptor {
  return {
    id: asCapabilityId(tool.id),
    name: tool.name,
    description: tool.description,
    version: tool.version,
    category: tool.category,
    permissions: tool.permissions,
    supportedPlatforms: tool.supportedPlatforms,
    requiredTools: tool.requiredTools,
    inputs: tool.inputs.map((name) => ({ name: String(name), type: 'object', required: true })),
    outputs: [],
  };
}

/**
 * Kernel module that installs the Nova Tool Runtime.
 *
 * Registering it during kernel boot makes `TOOL_RUNTIME_TOKEN` resolvable from
 * the container. Construction is deferred to the `register` phase so the manager
 * can pull the shared Event Bus and Logger, plus the **optional** seams:
 *  - `CAPABILITY_MANAGER_TOKEN` → the tool is advertised as a `Capability` (so
 *    the Studio API surfaces it), and unregistered on withdrawal.
 *  - `COORDINATOR_MANAGER_TOKEN` → a read-only `CoordinatorLink` (correlationId →
 *    mission) identical in shape to the one the vscode package builds.
 *
 * The dependency arrow stays acyclic and one-directional:
 * `tool-runtime → (events, capabilities, coordinator) → kernel`.
 */
export const toolRuntimeModule: {
  readonly name: string;
  register(kernel: StudioKernel): void | Promise<void>;
} = {
  name: 'nova.tool-runtime',
  async register(kernel: StudioKernel): Promise<void> {
    // The kernel makes the Event Bus and Logger available as properties for the
    // whole `service-registry` stage; their *tokens* are only registered in
    // later stages, so we read the properties here (mirrors TerminalModule).
    const bus = kernel.events;
    const logger = kernel.logger.child('tool-runtime');

    const capabilityManager = kernel.services.has(CAPABILITY_MANAGER_TOKEN)
      ? await kernel.services.resolve<CapabilityManager>(CAPABILITY_MANAGER_TOKEN)
      : undefined;
    const coordinatorManager = kernel.services.has(COORDINATOR_MANAGER_TOKEN)
      ? await kernel.services.resolve<CoordinatorManager>(COORDINATOR_MANAGER_TOKEN)
      : undefined;

    const manager = new Manager({
      eventBus: bus,
      logger,
      // Permissions granted to the running host. The Studio shell drives the
      // Development Workflows (and, through them, the VS Code + Terminal tools)
      // on the user's explicit behalf, so the read-only / safe actions those
      // workflows perform are pre-authorized here. The gate still records every
      // decision in the audit trail.
      grantedPermissions: [
        'fs.read',
        'fs.write',
        'fs.delete',
        'process.spawn',
        'process.kill',
        'system.env',
      ],
    });

    const coordinatorLink: CoordinatorLink | undefined = coordinatorManager
      ? {
          resolveMission(correlationId) {
            const mission = coordinatorManager.find(correlationId as never);
            return mission === undefined ? null : { missionId: String(mission.id) };
          },
        }
      : undefined;

    const capabilitiesLink: CapabilitiesLink | undefined = capabilityManager
      ? {
          advertise: (descriptor) => {
            const cap = new ToolCapability(
              toCapabilityDescriptor(descriptor),
              (request) =>
                manager.invoke({
                  toolId: request.toolId as ToolId,
                  action: request.action,
                  input: request.input,
                  actor: { kind: 'tool-runtime' },
                  correlationId: request.correlationId as UUID | null,
                }),
              () => manager.assessHealth(descriptor.id as ToolId),
            );
            capabilityManager.register(cap);
            void capabilityManager.enable(asCapabilityId(descriptor.id)).catch((error: unknown) => {
              logger.warn('tool.capability-enable-failed', {
                id: descriptor.id,
                error: error instanceof Error ? error.message : String(error),
              });
            });
          },
          withdraw: (toolId) => {
            capabilityManager.unregister(asCapabilityId(toolId));
          },
        }
      : undefined;

    manager.attach({ capabilities: capabilitiesLink, coordinator: coordinatorLink });

    kernel.registerService({
      token: TOOL_RUNTIME_TOKEN,
      singleton: true,
      factory: () => manager,
    });
  },
};
