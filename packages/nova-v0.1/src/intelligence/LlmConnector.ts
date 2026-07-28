import type { BuiltPrompt, ModelSelection } from './types';

export interface LlmResponse {
  readonly content: string;
  readonly model: string;
  readonly provider: string;
  readonly latencyMs: number;
}

const DEFAULT_API_BASE = 'https://openrouter.ai/api/v1';

async function callApi(
  prompt: BuiltPrompt,
  selection: ModelSelection,
  apiKey: string,
  baseUrl: string,
): Promise<LlmResponse> {
  const start = performance.now();
  const url = `${baseUrl}/chat/completions`;

  const body = {
    model: selection.model,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    temperature: 0.1,
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'unknown error');
    throw new Error(`LLM API error (${response.status}): ${text}`);
  }

  const json = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
  };

  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('LLM returned empty response');
  }

  return {
    content,
    model: json.model ?? selection.model,
    provider: selection.provider,
    latencyMs: Math.round(performance.now() - start),
  };
}

export async function callLlm(
  prompt: BuiltPrompt,
  selection: ModelSelection,
  config?: {
    apiKey?: string;
    baseUrl?: string;
  },
): Promise<LlmResponse> {
  const apiKey = config?.apiKey ?? process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
  if (!apiKey) {
    throw new Error('No API key configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.');
  }

  const baseUrl = config?.baseUrl ?? process.env.LLM_API_BASE ?? DEFAULT_API_BASE;
  return callApi(prompt, selection, apiKey, baseUrl);
}