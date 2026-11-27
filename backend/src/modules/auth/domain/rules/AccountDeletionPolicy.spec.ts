import { ACCOUNT_DELETION_GRACE_DAYS, accountDeletionDueAt } from './AccountDeletionPolicy';

describe('AccountDeletionPolicy', () => {
  it('is 30 days, the legal deadline of S04 §7', () => {
    expect(ACCOUNT_DELETION_GRACE_DAYS).toBe(30);
  });

  it.each([
    ['2026-09-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'],
    ['2027-01-01T14:00:00.000Z', '2027-01-31T00:00:00.000Z'],
    ['2027-01-01T23:59:59.999Z', '2027-01-31T00:00:00.000Z'],
    ['2027-01-31T10:00:00.000Z', '2027-03-02T00:00:00.000Z'],
    ['2027-02-01T10:00:00.000Z', '2027-03-03T00:00:00.000Z'],
    ['2028-02-01T10:00:00.000Z', '2028-03-02T00:00:00.000Z'],
  ])('makes a deactivation of %s due on %s, whatever the hour', (deactivatedAt, dueAt) => {
    expect(accountDeletionDueAt(new Date(deactivatedAt))).toEqual(new Date(dueAt));
  });

  it('reads the date in UTC: just after midnight in Paris is still the day before', () => {
    expect(accountDeletionDueAt(new Date('2027-01-02T00:30:00.000+01:00'))).toEqual(
      new Date('2027-01-31T00:00:00.000Z'),
    );
  });
});
