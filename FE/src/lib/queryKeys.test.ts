import { describe, expect, it } from 'vitest';
import { queryKeys } from './queryKeys';

describe('service-ticket query keys', () => {
  it('separates general create options from device-service form options', () => {
    expect(queryKeys.serviceTickets.createOptions).not.toEqual(
      queryKeys.serviceTickets.deviceServiceOptions,
    );
  });
});
