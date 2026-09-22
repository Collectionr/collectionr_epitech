import { AuditEntry } from './AuditEntry';

const baseProps = {
  userId: null,
  action: 'collection.create',
  targetType: null,
  targetId: null,
  metadata: null,
  occurredAt: new Date('2026-01-01T00:00:00.000Z'),
  retentionDays: 90,
};

describe('AuditEntry', () => {
  it('derives expiresAt from the timestamp and the retention', () => {
    const entry = AuditEntry.record(baseProps);

    expect(entry.timestamp).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(entry.expiresAt).toEqual(new Date('2026-04-01T00:00:00.000Z'));
  });

  it('keeps the provided fields', () => {
    const entry = AuditEntry.record({
      ...baseProps,
      userId: '0b1f6c1e-6c1e-4b1e-8b1e-1b1e6c1e4b1e',
      targetType: 'collection',
      metadata: { name: 'Base Set' },
    });

    expect(entry.userId).toBe('0b1f6c1e-6c1e-4b1e-8b1e-1b1e6c1e4b1e');
    expect(entry.targetType).toBe('collection');
    expect(entry.metadata).toEqual({ name: 'Base Set' });
  });

  it.each(['login', 'Auth.Login', 'auth..login', 'auth.login.', '.auth', 'auth login', ''])(
    'rejects the invalid action "%s"',
    (action) => {
      expect(AuditEntry.isValidAction(action)).toBe(false);
      expect(() => AuditEntry.record({ ...baseProps, action })).toThrow(/Invalid audit action/);
    },
  );

  it.each(['auth.login', 'auth.login.failed', 'user.password_change'])(
    'accepts the action "%s"',
    (action) => {
      expect(AuditEntry.isValidAction(action)).toBe(true);
    },
  );

  it.each([0, -1, 1.5, Number.NaN])('rejects a retention of %s days', (retentionDays) => {
    expect(() => AuditEntry.record({ ...baseProps, retentionDays })).toThrow(/retention/);
  });
});
