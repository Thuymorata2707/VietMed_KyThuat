import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { requestContext } from '../request-context';

export function createRequestContextMiddleware() {
  return (_request: Request, response: Response, next: NextFunction) => {
    const requestId = randomUUID();
    response.setHeader('X-Request-ID', requestId);
    requestContext.run({ requestId }, next);
  };
}
