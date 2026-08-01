import type { ModelProvidersService } from '@gamedev-agent/model-providers';
import type { ToolManager, ToolInvocationResult } from '@gamedev-agent/tool-runtime';
import { asToolId } from '@gamedev-agent/tool-runtime';
import type { FileSystemAdapter, ILLMProvider, TerminalAdapter } from './interfaces';

/**
 * Adapts Nova's EXISTING {@link ModelProvidersService} to the narrow
 * {@link ILLMProvider} seam AMI's reasoning components need. AMI never creates
 * its own LLM client or touches API keys — all model traffic flows through the
 * service already registered in the kernel.
 */
export class ModelProvidersLlmAdapter implements ILLMProvider {
  constructor(
    private readonly modelProviders: ModelProvidersService,
    private readonly model: string = 'gpt-4o',
  ) {}

  async complete(prompt: string): Promise<string> {
    const response = await this.modelProviders.generate({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1024,
      metadata: { subsystem: 'ami' },
    });
    return response.content ?? '';
  }
}

/**
 * Adapts Nova's EXISTING {@link ToolManager} (routing through the registered
 * filesystem tool) to the {@link FileSystemAdapter} seam verification
 * strategies use. Only the tool's `invoke` is used — no concrete adapter is
 * ever constructed or reached directly.
 */
export class ToolManagerFileSystemAdapter implements FileSystemAdapter {
  constructor(
    private readonly toolManager: ToolManager,
    private readonly toolId: string = 'nova.tool.filesystem',
  ) {}

  async readFile(path: string): Promise<string> {
    const result = await this.invoke('files.read', { path });
    if (!result.ok) {
      throw new Error(result.error?.message ?? `files.read failed for "${path}"`);
    }
    if (typeof result.output === 'string') {
      return result.output;
    }
    return result.output === null ? '' : JSON.stringify(result.output);
  }

  async listFiles(
    dirPath: string,
  ): Promise<ReadonlyArray<{ readonly name: string; readonly path: string; readonly isDirectory: boolean }>> {
    const result = await this.invoke('files.list', { dirPath });
    if (!result.ok) {
      throw new Error(result.error?.message ?? `files.list failed for "${dirPath}"`);
    }
    if (Array.isArray(result.output)) {
      return result.output.map((entry) => ({
        name: String((entry as Record<string, unknown>).name ?? ''),
        path: String((entry as Record<string, unknown>).path ?? ''),
        isDirectory: Boolean((entry as Record<string, unknown>).isDirectory ?? false),
      }));
    }
    return [];
  }

  private invoke(action: string, input: Record<string, unknown>): Promise<ToolInvocationResult> {
    return this.toolManager.invoke({
      toolId: asToolId(this.toolId),
      action,
      input: input as Parameters<ToolManager['invoke']>[0]['input'],
      actor: { kind: 'ami-verification' },
      correlationId: null,
    });
  }
}

/**
 * Adapts Nova's EXISTING {@link ToolManager} (routing through the registered
 * terminal tool) to the {@link TerminalAdapter} seam verification strategies
 * use.
 */
export class ToolManagerTerminalAdapter implements TerminalAdapter {
  constructor(
    private readonly toolManager: ToolManager,
    private readonly toolId: string = 'nova.tool.terminal',
  ) {}

  async run(
    command: string,
    args: ReadonlyArray<string>,
    options?: { readonly cwd?: string; readonly timeoutMs?: number },
  ): Promise<{ readonly exitCode: number; readonly stdout: string; readonly stderr: string }> {
    const result = await this.toolManager.invoke({
      toolId: asToolId(this.toolId),
      action: 'terminal.run',
      input: { command, args: [...args], ...(options?.cwd !== undefined ? { cwd: options.cwd } : {}), ...(options?.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}) } as Parameters<ToolManager['invoke']>[0]['input'],
      actor: { kind: 'ami-verification' },
      correlationId: null,
    });
    if (!result.ok) {
      throw new Error(result.error?.message ?? `terminal.run failed for "${command}"`);
    }
    const output = (result.output ?? {}) as Record<string, unknown>;
    return {
      exitCode: typeof output.exitCode === 'number' ? output.exitCode : 0,
      stdout: typeof output.stdout === 'string' ? output.stdout : '',
      stderr: typeof output.stderr === 'string' ? output.stderr : '',
    };
  }
}
