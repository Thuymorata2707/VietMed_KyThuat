import { NextFunction, Request, Response } from 'express';
import { AppConfigService } from '../../config/app-config.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER = 'x-csrf-protection';

export function createCsrfProtectionMiddleware(config: AppConfigService) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(request.method)) {
      next();
      return;
    }

    const usesBearerToken = Boolean(request.headers.authorization);
    const hasAuthCookie = request.headers.cookie
      ?.split(';')
      .some((cookie) => cookie.trim().startsWith(`${config.authCookieName}=`));

    if (!hasAuthCookie || usesBearerToken) {
      next();
      return;
    }

    if (request.headers[CSRF_HEADER] === '1') {
      next();
      return;
    }

    response.status(403).json({
      statusCode: 403,
      message: 'Missing CSRF protection header',
      error: 'Forbidden',
    });
  };
}
