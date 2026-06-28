import { HttpException } from '@nestjs/common';
import { LoginThrottleService } from './login-throttle.service';

describe('LoginThrottleService', () => {
  it('locks an email and ip after repeated failures', () => {
    const throttle = new LoginThrottleService();

    for (let index = 0; index < 5; index += 1) {
      throttle.recordFailure('user@example.com', '127.0.0.1');
    }

    expect(() =>
      throttle.assertCanAttempt('user@example.com', '127.0.0.1'),
    ).toThrow(HttpException);
  });

  it('resets failures after a successful login', () => {
    const throttle = new LoginThrottleService();

    throttle.recordFailure('user@example.com', '127.0.0.1');
    throttle.recordFailure('user@example.com', '127.0.0.1');
    throttle.recordSuccess('user@example.com', '127.0.0.1');

    expect(() =>
      throttle.assertCanAttempt('user@example.com', '127.0.0.1'),
    ).not.toThrow();
  });
});
