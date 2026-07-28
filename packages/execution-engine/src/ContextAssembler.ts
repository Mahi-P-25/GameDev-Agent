import type { ContextManager, ContextPipeline, CurrentContext } from '@gamedev-agent/context';
import type { ContextRequest } from '@gamedev-agent/context';
import type { Logger } from '@gamedev-agent/logging';
import type { ModelProvidersService } from '@gamedev-agent/model-providers';
import type { Message } from '@gamedev-agent/model-providers';
import type { WorkflowStep, WorkflowStepContext } from '@gamedev-agent/workflow';
import { ContextAssemblyError } from './errors';
import type { AssembledContext, CapabilityMapping } from './types';
import { mapStepToCapabilities } from './types';

export class ContextAssembler {
  constructor(
    private readonly contextPipeline: ContextPipeline,
    private readonly contextManager: ContextManager,
    private readonly modelProviders: ModelProvidersService,
    private readonly logger?: Logger,
  ) {}

  async assemble(
    step: WorkflowStep,
    workflowCtx: WorkflowStepContext,
  ): Promise<AssembledContext> {
    const startTime = Date.now();

    try {
      const mapping = mapStepToCapabilities(step);
      const currentContext = await this.getCurrentContext(workflowCtx);

      const maxTokens = this.selectMaxTokens(mapping);
      const request: ContextRequest = {
        role: mapping.role as ContextRequest['role'],
        purpose: mapping.purpose,
        maxTokens,
        query: `${step.title}: ${step.description}`,
        metadata: {
          stepId: step.id,
          executionId: workflowCtx.executionId,
          projectId: workflowCtx.projectId,
        },
      };

      const contextPackage = await this.contextPipeline.execute(request, currentContext);

      const modelId = this.selectModelId(mapping);
      const systemPrompt = this.buildSystemPrompt(contextPackage, step);
      const messages = this.buildMessages(systemPrompt, step, workflowCtx);

      const latencyMs = Date.now() - startTime;
      this.logger?.debug('Context assembled', {
        stepId: step.id,
        modelId,
        items: contextPackage.items.length,
        totalTokens: contextPackage.totalTokens,
        latencyMs,
      });

      return {
        systemPrompt,
        messages,
        contextPackage,
        modelId,
        maxTokens,
        requiredCapabilities: mapping.capabilities,
      };
    } catch (error) {
      throw new ContextAssemblyError(
        `Failed to assemble context for step ${step.id}: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  private async getCurrentContext(workflowCtx: WorkflowStepContext): Promise<CurrentContext> {
    return this.contextManager.getCurrentContext({
      projectId: workflowCtx.projectId as any,
      workflowExecutionId: workflowCtx.executionId as any,
      missionId: workflowCtx.missionId as any,
    });
  }

  private selectMaxTokens(mapping: CapabilityMapping): number {
    switch (mapping.purpose) {
      case 'codegen': return 128_000;
      case 'planning': return 200_000;
      case 'review': return 64_000;
      case 'debug': return 128_000;
      default: return 64_000;
    }
  }

  private selectModelId(mapping: CapabilityMapping): string {
    const models = this.modelProviders.findModels(mapping.capabilities);
    if (models.length === 0) {
      this.logger?.warn('No model found for capabilities', { capabilities: mapping.capabilities });
      return 'gpt-4o';
    }
    return models[0]?.id ?? 'gpt-4o';
  }

  private buildSystemPrompt(contextPackage: AssembledContext['contextPackage'], step: WorkflowStep): string {
    const sections: string[] = [
      `You are executing step "${step.title}" in a game development workflow.`,
      '',
      '## Context',
      ...contextPackage.items.map((item) => item.content),
    ];

    if (step.description) {
      sections.push('', '## Task', step.description);
    }

    return sections.join('\n');
  }

  private buildMessages(
    systemPrompt: string,
    step: WorkflowStep,
    workflowCtx: WorkflowStepContext,
  ): readonly Message[] {
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Execute step "${step.title}": ${step.description}\n\nProject: ${workflowCtx.projectId}\nAttempt: ${workflowCtx.attempt}`,
      },
    ];
    return messages;
  }
}
