import { addDateOnlyDays, startOfVietnamDay } from './date-only';

describe('date-only boundaries', () => {
  it('uses the Vietnam calendar day regardless of UTC time', () => {
    expect(startOfVietnamDay(new Date('2026-09-23T17:30:00.000Z'))).toEqual(
      new Date('2026-09-24T00:00:00.000Z'),
    );
  });

  it('adds calendar days to date-only UTC values', () => {
    expect(
      addDateOnlyDays(new Date('2026-09-24T00:00:00.000Z'), 30),
    ).toEqual(new Date('2026-10-24T00:00:00.000Z'));
  });
});
