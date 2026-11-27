import { AuditEntry } from '../../../audit/domain/entities/AuditEntry';
import { AuditAccountErasureTrail } from './AuditAccountErasureTrail';
import type { RecordAuditEntryUseCase } from '../../../audit/application/use-cases/RecordAuditEntryUseCase';

describe('AuditAccountErasureTrail', () => {
  const execute = jest.fn();
  const trail = new AuditAccountErasureTrail({ execute } as unknown as RecordAuditEntryUseCase);

  beforeEach(() => {
    jest.resetAllMocks();
    execute.mockResolvedValue(undefined);
  });

  it('records the request as an action on the account itself, with no metadata', async () => {
    await trail.recordDeletionRequested('user-1');

    expect(execute).toHaveBeenCalledWith({
      userId: 'user-1',
      action: 'auth.account.deletion_requested',
      targetType: 'user',
      targetId: 'user-1',
    });
  });

  it('records the anonymization with the date it was scheduled for only', async () => {
    await trail.recordAnonymized('user-1', new Date('2026-11-01T10:00:00.000Z'));

    expect(execute).toHaveBeenCalledWith({
      userId: 'user-1',
      action: 'auth.account.anonymized',
      targetType: 'user',
      targetId: 'user-1',
      metadata: { deletionScheduledFor: '2026-11-01T10:00:00.000Z' },
    });
  });

  it('uses action names the audit trail accepts', () => {
    expect(AuditEntry.isValidAction('auth.account.deletion_requested')).toBe(true);
    expect(AuditEntry.isValidAction('auth.account.anonymized')).toBe(true);
  });

  it('lets an audit failure through: the caller decides, and stops the change', async () => {
    execute.mockRejectedValue(new Error('audit down'));

    await expect(trail.recordAnonymized('user-1', new Date())).rejects.toThrow('audit down');
  });
});
