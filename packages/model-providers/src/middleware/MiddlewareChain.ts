import type { Middleware, MiddlewareChain as MiddlewareChainInterface, MiddlewareContext, MiddlewareResult, NextMiddleware } from '../interfaces';

export class MiddlewareChain implements MiddlewareChainInterface {
  private readonly middlewares: Middleware[] = [];

  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  async execute(context: MiddlewareContext, finalHandler: NextMiddleware): Promise<MiddlewareResult> {
    const combined = this.middlewares.reduceRight(
      (next: NextMiddleware, middleware: Middleware): NextMiddleware => {
        return async (ctx: MiddlewareContext): Promise<MiddlewareResult> => {
          return middleware.handle(ctx, next);
        };
      },
      finalHandler,
    );
    return combined(context);
  }
}
