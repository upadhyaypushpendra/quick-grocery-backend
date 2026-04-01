import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request & { user?: { id: string } } = ctx
      .switchToHttp()
      .getRequest();

    return request.user;
  },
);
