import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

type LoginAttempt = {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
};

@Injectable()
export class LoginThrottleService {
  private readonly attempts = new Map<string, LoginAttempt>();

  assertCanAttempt(email: string | undefined, ip: string | undefined) {
    const key = this.keyFor(email, ip);
    const current = this.attempts.get(key);
    const now = Date.now();

    if (!current) {
      return;
    }

    if (current.lockedUntil && current.lockedUntil > now) {
      throw new HttpException(
        'Too many failed login attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (now - current.firstAttemptAt > WINDOW_MS) {
      this.attempts.delete(key);
    }
  }

  recordFailure(email: string | undefined, ip: string | undefined) {
    const key = this.keyFor(email, ip);
    const now = Date.now();
    const current = this.attempts.get(key);

    if (!current || now - current.firstAttemptAt > WINDOW_MS) {
      this.attempts.set(key, {
        count: 1,
        firstAttemptAt: now,
      });
      return;
    }

    const nextCount = current.count + 1;
    this.attempts.set(key, {
      count: nextCount,
      firstAttemptAt: current.firstAttemptAt,
      lockedUntil: nextCount >= MAX_FAILED_ATTEMPTS ? now + LOCK_MS : undefined,
    });
  }

  recordSuccess(email: string | undefined, ip: string | undefined) {
    this.attempts.delete(this.keyFor(email, ip));
  }

  private keyFor(email: string | undefined, ip: string | undefined) {
    return `${email?.toLowerCase().trim() || 'unknown'}:${ip || 'unknown'}`;
  }
}
