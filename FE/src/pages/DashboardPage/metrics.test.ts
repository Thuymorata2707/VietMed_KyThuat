import { describe, expect, it } from 'vitest';
import { totalOpenWorkCount } from './metrics';

describe('dashboard metrics', () => {
  it('includes each open operational queue in the headline total', () => {
    expect(totalOpenWorkCount({
      repairs: 3,
      maintenances: 2,
      installations: 25,
      demoLoans: 1,
      deviceServiceTickets: 4,
    })).toBe(35);
  });
});
