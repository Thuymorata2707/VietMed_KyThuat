import { Injectable } from '@nestjs/common';

const DEFAULT_JWT_SECRET = 'vietmed-dev-secret';

@Injectable()
export class AppConfigService {
  readonly nodeEnv = process.env.NODE_ENV ?? 'development';
  readonly authCookieName =
    process.env.AUTH_COOKIE_NAME?.trim() || 'vietmed_access_token';
  readonly authCookieDomain = process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined;
  readonly authCookieSecure = this.readBoolean(
    process.env.AUTH_COOKIE_SECURE,
    this.isProduction(),
  );
  readonly authCookieSameSite = this.readCookieSameSite(
    process.env.AUTH_COOKIE_SAME_SITE,
  );
  readonly port = this.parsePort(process.env.PORT);
  readonly jwtSecret = this.readJwtSecret();
  readonly jwtExpiresInSeconds = this.parsePositiveInteger(
    process.env.JWT_EXPIRES_IN,
    28_800,
    'JWT_EXPIRES_IN',
  );
  readonly jwtIssuer =
    process.env.JWT_ISSUER?.trim() || 'vietmed-ky-thuat-api';
  readonly jwtAudience =
    process.env.JWT_AUDIENCE?.trim() || 'vietmed-ky-thuat-web';
  readonly rateLimitWindowMs = this.parsePositiveInteger(
    process.env.RATE_LIMIT_WINDOW_MS,
    60_000,
    'RATE_LIMIT_WINDOW_MS',
  );
  readonly rateLimitMax = this.parsePositiveInteger(
    process.env.RATE_LIMIT_MAX,
    this.isProduction() ? 300 : 1000,
    'RATE_LIMIT_MAX',
  );
  readonly authRateLimitMax = this.parsePositiveInteger(
    process.env.AUTH_RATE_LIMIT_MAX,
    20,
    'AUTH_RATE_LIMIT_MAX',
  );
  readonly uploadMaxFileSizeBytes = this.parsePositiveInteger(
    process.env.UPLOAD_MAX_FILE_SIZE_BYTES,
    10 * 1024 * 1024,
    'UPLOAD_MAX_FILE_SIZE_BYTES',
  );
  readonly corsOrigins = this.readCorsOrigins();
  readonly enableSwagger = this.readBoolean(
    process.env.ENABLE_SWAGGER,
    !this.isProduction(),
  );

  validate() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required');
    }

    if (
      this.isProduction() &&
      (this.jwtSecret === DEFAULT_JWT_SECRET ||
        this.jwtSecret === 'change-me-in-production' ||
        this.jwtSecret.length < 32)
    ) {
      throw new Error('JWT_SECRET must be set to a strong value in production');
    }

    if (this.isProduction() && this.jwtExpiresInSeconds > 43_200) {
      throw new Error('JWT_EXPIRES_IN must be 43200 seconds or less in production');
    }

    if (this.isProduction() && !process.env.CORS_ORIGINS?.trim()) {
      throw new Error('CORS_ORIGINS is required in production');
    }
  }

  isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  private readJwtSecret(): string {
    const secret = process.env.JWT_SECRET?.trim();

    if (secret) {
      return secret;
    }

    return DEFAULT_JWT_SECRET;
  }

  private parsePort(value?: string): number {
    return this.parsePositiveInteger(value, 3000, 'PORT');
  }

  private readCorsOrigins(): string[] {
    const configuredOrigins = process.env.CORS_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    if (configuredOrigins?.length) {
      return configuredOrigins;
    }

    return [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'https://viet-med-ky-thuat.vercel.app',
    ];
  }

  private parsePositiveInteger(
    value: string | undefined,
    fallback: number,
    key: string,
  ): number {
    if (!value) {
      return fallback;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(`${key} must be a positive integer`);
    }

    return parsed;
  }

  private readBoolean(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined) {
      return fallback;
    }

    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }

  private readCookieSameSite(value?: string): 'lax' | 'strict' | 'none' {
    const normalized = value?.trim().toLowerCase();

    if (normalized === 'lax' || normalized === 'strict' || normalized === 'none') {
      return normalized;
    }

    return this.isProduction() ? 'none' : 'lax';
  }
}
