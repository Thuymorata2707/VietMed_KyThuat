import { Injectable } from '@nestjs/common';

const DEFAULT_JWT_SECRET = 'vietmed-dev-secret';

@Injectable()
export class AppConfigService {
  readonly nodeEnv = process.env.NODE_ENV ?? 'development';
  readonly port = this.parsePort(process.env.PORT);
  readonly jwtSecret = this.readJwtSecret();
  readonly jwtExpiresInSeconds = this.parsePositiveInteger(
    process.env.JWT_EXPIRES_IN,
    86400,
    'JWT_EXPIRES_IN',
  );

  validate() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required');
    }

    if (this.isProduction() && this.jwtSecret === DEFAULT_JWT_SECRET) {
      throw new Error('JWT_SECRET is required in production');
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
}
