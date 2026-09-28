import { Request, Response, NextFunction } from 'express';
import { AppConfigService } from '../../config/app-config.service';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();
let lastCleanupAt = 0;

export function createRateLimitMiddleware(config: AppConfigService) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (request.method === 'OPTIONS') {
      next();
      return;
    }

    const now = Date.now();
    cleanupExpiredBuckets(now);

    const isAuthRequest = request.path === '/auth/login';
    const max = isAuthRequest ? config.authRateLimitMax : config.rateLimitMax;
    const windowMs = config.rateLimitWindowMs;
    const key = `${isAuthRequest ? 'auth' : 'api'}:${request.ip || request.socket.remoteAddress || 'unknown'}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      setRateLimitHeaders(response, max, max - 1, now + windowMs);
      next();
      return;
    }

    if (current.count >= max) {
      setRateLimitHeaders(response, max, 0, current.resetAt);
      response.setHeader(
        'Retry-After',
        Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      );
      response.status(429).json({
        statusCode: 429,
        message: 'Too many requests. Please try again later.',
        error: 'Too Many Requests',
      });
      return;
    }

    current.count += 1;
    setRateLimitHeaders(
      response,
      max,
      Math.max(0, max - current.count),
      current.resetAt,
    );
    next();
  };
}

function setRateLimitHeaders(
  response: Response,
  limit: number,
  remaining: number,
  resetAt: number,
) {
  response.setHeader('X-RateLimit-Limit', limit);
  response.setHeader('X-RateLimit-Remaining', remaining);
  response.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));
}

function cleanupExpiredBuckets(now: number) {
  if (now - lastCleanupAt < 60_000) {
    return;
  }

  lastCleanupAt = now;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}
