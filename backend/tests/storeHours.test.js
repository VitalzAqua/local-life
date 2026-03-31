const {
  getCurrentBusinessTime,
  isStoreOpenNow,
  isReservationWithinStoreHours,
  isFutureBusinessDateTime
} = require('../utils/storeHours');

describe('store hours utilities', () => {
  test('uses Toronto business time when checking current store hours', () => {
    const utcDate = new Date('2026-03-31T14:30:00Z');

    expect(getCurrentBusinessTime(utcDate)).toBe('10:30');
    expect(isStoreOpenNow({ open: '08:00', close: '23:00' }, undefined, utcDate)).toBe(true);
    expect(isStoreOpenNow({ open: '11:00', close: '23:00' }, undefined, utcDate)).toBe(false);
  });

  test('treats reservation timestamps as Toronto local wall-clock time', () => {
    expect(
      isReservationWithinStoreHours('2026-03-31T22:15:00', { open: '08:00', close: '23:00' })
    ).toBe(true);

    expect(
      isReservationWithinStoreHours('2026-03-31T23:30:00', { open: '08:00', close: '23:00' })
    ).toBe(false);
  });

  test('compares reservation future checks against current Toronto local time', () => {
    const utcNow = new Date('2026-03-31T14:30:00Z');

    expect(isFutureBusinessDateTime('2026-03-31T10:45:00', undefined, utcNow)).toBe(true);
    expect(isFutureBusinessDateTime('2026-03-31T10:15:00', undefined, utcNow)).toBe(false);
  });
});
