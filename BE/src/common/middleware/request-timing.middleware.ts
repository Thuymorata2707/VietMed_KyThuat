import { NextFunction, Request, Response } from 'express';

/** Logs only slow API requests and excludes query strings and request data. */
export function createRequestTimingMiddleware() {
  const thresholdMs = readThreshold();

  return (request: Request, response: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();

    response.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      if (durationMs < thresholdMs || !request.path.startsWith('/api/')) {
        return;
      }

      console.warn(
        JSON.stringify({
          type: 'slow_api_request',
          requestId: response.getHeader('X-Request-ID'),
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

function readThreshold() {
  const rawValue = process.env.SLOW_REQUEST_LOG_MS;
  if (rawValue === undefined || rawValue.trim() === '') return 500;
  const configured = Number(rawValue);
  return Number.isFinite(configured) && configured >= 0 ? configured : 500;
}
