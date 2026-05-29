import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { RequestUser } from '../common/request-user.type';

type JwtPayload = RequestUser & {
  iat: number;
  exp: number;
};

@Injectable()
export class JwtService {
  private readonly secret = process.env.JWT_SECRET ?? 'vietmed-dev-secret';
  private readonly expiresInSeconds = Number(
    process.env.JWT_EXPIRES_IN ?? 86400,
  );

  sign(user: RequestUser): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      ...user,
      iat: now,
      exp: now + this.expiresInSeconds,
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

    const expectedSignature = this.createSignature(
      `${encodedHeader}.${encodedPayload}`,
    );

    if (!this.safeCompare(signature, expectedSignature)) {
      throw new UnauthorizedException('Invalid token');
    }

    const payload = JSON.parse(
      this.base64UrlDecode(encodedPayload),
    ) as JwtPayload;

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Token expired');
    }

    return payload;
  }

  private createSignature(value: string): string {
    return createHmac('sha256', this.secret).update(value).digest('base64url');
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
