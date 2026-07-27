import type { Middleware, MiddlewareContext, MiddlewareResult, NextMiddleware } from '../interfaces';
import { ModelContextWindowError } from '../types';

export class ContextWindowValidator implements Middleware {
  readonly name = 'ContextWindowValidator';

  constructor(private readonly countTokens: (text: string) => number) {}

  async handle(context: MiddlewareContext, next: NextMiddleware): Promise<MiddlewareResult> {
    const { request, provider } = context;
    const modelInfo = request.model !== undefined
      ? provider.getModelInfo(request.model)
      : undefined;

    if (modelInfo === undefined) {
      return next(context);
    }

    const requestedTokens = this.estimateRequestTokens(request);
    const availableTokens = modelInfo.contextWindow - (request.maxTokens ?? modelInfo.maxOutputTokens);

    if (requestedTokens > availableTokens) {
      throw new ModelContextWindowError(
        `Request tokens (${requestedTokens}) exceed available context window (${availableTokens}) for model ${modelInfo.id}`,
        requestedTokens,
        availableTokens,
        provider.kind,
      );
    }

    return next(context);
  }

  private estimateRequestTokens(request: MiddlewareContext['request']): number {
    let total = 0;
    for (const message of request.messages) {
      if (typeof message.content === 'string') {
        total += this.countTokens(message.content);
      } else {
        for (const part of message.content) {
          if (part.type === 'text') {
            total += this.countTokens(part.text);
          } else {
            total += 100;
          }
        }
      }
      total += 4;
    }

    if (request.tools !== undefined) {
      for (const tool of request.tools) {
        total += this.countTokens(JSON.stringify(tool));
      }
    }

    return total;
  }
}
