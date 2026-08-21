import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { RequestUser } from '../common/request-user.type';
import { AppConfigService } from '../config/app-config.service';

type JwtPayload = RequestUser & {
  aud: string;
  iat: number;
  iss: string;
  exp: number;
  jti: string;
  sub: string;
};

type JwtHeader = {
  alg: string;
  typ: string;
};

@Injectable()
export class JwtService {
  constructor(private readonly config: AppConfigService) {}

  sign(user: RequestUser): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      ...user,
      aud: this.config.jwtAudience,
      iat: now,
      iss: this.config.jwtIssuer,
      exp: now + this.config.jwtExpiresInSeconds,
      jti: randomUUID(),
      sub: user.id,
    };

    const encodedHeader = this.base64UrlEncode(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    );
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.createSignature(
      `${encodedHeader}.${encodedPayload}`,
    );

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  verify(token: string): JwtPayload {
    const [encodedHeader, encodedPayload, signature] = token.split('.');

    if (!encodedHeader || !encodedPayload || !signature) {
      throw new UnauthorizedException('Invalid token');
    }

    let header: JwtHeader;

    try {
      header = JSON.parse(this.base64UrlDecode(encodedHeader)) as JwtHeader;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      throw new UnauthorizedException('Invalid token');
    }

    const expectedSignature = this.createSignature(
      `${encodedHeader}.${encodedPayload}`,
    );

    if (!this.safeCompare(signature, expectedSignature)) {
      throw new UnauthorizedException('Invalid token');
    }

    let payload: JwtPayload;

    try {
      payload = JSON.parse(this.base64UrlDecode(encodedPayload)) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Token expired');
    }

    if (
      payload.iss !== this.config.jwtIssuer ||
      payload.aud !== this.config.jwtAudience ||
      payload.sub !== payload.id ||
      !payload.jti
    ) {
      throw new UnauthorizedException('Invalid token');
    }

    return payload;
  }

  private createSignature(value: string): string {
    return createHmac('sha256', this.config.jwtSecret)
      .update(value)
      .digest('base64url');
  }

  private base64UrlEncode(value: string): string {
    return Buffer.from(value).toString('base64url');
  }

  private base64UrlDecode(value: string): string {
    return Buffer.from(value, 'base64url').toString('utf8');
  }

  private safeCompare(value: string, expected: string): boolean {
    const valueBuffer = Buffer.from(value);
    const expectedBuffer = Buffer.from(expected);

    if (valueBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(valueBuffer, expectedBuffer);
  }
}
