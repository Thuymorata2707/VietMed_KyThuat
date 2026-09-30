import { NextFunction, Request, Response } from 'express';

const SLOW_REQUEST_THRESHOLD_MS = 500;

/** Logs only slow API requests and excludes query strings and request data. */
export function createRequestTimingMiddleware() {
  return (request: Request, response: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();

    response.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      if (durationMs < SLOW_REQUEST_THRESHOLD_MS || !request.path.startsWith('/api/')) {
        return;
      }

      console.warn(
        JSON.stringify({
          type: 'slow_api_request',
          method: request.method,
          path: request.path,
          statusCode: response.statusCode,
          durationMs: Math.round(durationMs),
        }),
      );
    });

    next();
  };
}
