import {
  ACCOUNT_DELETION_GRACE_DAYS,
  accountDeletionCutoff,
  accountDeletionDueAt,
} from './AccountDeletionPolicy';

describe('AccountDeletionPolicy', () => {
  it('is 30 days, the legal deadline of S04 §7', () => {
    expect(ACCOUNT_DELETION_GRACE_DAYS).toBe(30);
  });

  it('puts the due date 30 days after the request', () => {
    expect(accountDeletionDueAt(new Date('2026-11-01T10:00:00.000Z'))).toEqual(
      new Date('2026-12-01T10:00:00.000Z'),
    );
  });

  it('puts the cutoff 30 days before now, the inverse of the due date', () => {
    const now = new Date('2026-12-01T10:00:00.000Z');

    expect(accountDeletionCutoff(now)).toEqual(new Date('2026-11-01T10:00:00.000Z'));
    expect(accountDeletionDueAt(accountDeletionCutoff(now))).toEqual(now);
  });
});
