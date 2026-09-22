import type { AuditEntry } from '../../domain/entities/AuditEntry';
import type { IAuditLogRepository } from '../ports/IAuditLogRepository';
import { RecordAuditEntryUseCase } from './RecordAuditEntryUseCase';

describe('RecordAuditEntryUseCase', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function build(record: jest.Mock = jest.fn().mockResolvedValue(undefined)): {
    useCase: RecordAuditEntryUseCase;
    record: jest.Mock;
  } {
    const repository: IAuditLogRepository = { record };
    return { useCase: new RecordAuditEntryUseCase(repository, 90), record };
  }

  it('records an entry with the configured retention', async () => {
    const { useCase, record } = build();

    await useCase.execute({
      userId: '0b1f6c1e-6c1e-4b1e-8b1e-1b1e6c1e4b1e',
      action: 'collection.create',
      targetType: 'collection',
      metadata: { name: 'Base Set' },
    });

    const entry = (record.mock.calls[0] as [AuditEntry])[0];
    expect(entry.action).toBe('collection.create');
    expect(entry.userId).toBe('0b1f6c1e-6c1e-4b1e-8b1e-1b1e6c1e4b1e');
    expect(entry.metadata).toEqual({ name: 'Base Set' });
    expect(entry.timestamp).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(entry.expiresAt).toEqual(new Date('2026-04-01T00:00:00.000Z'));
  });

  it('defaults the optional fields to null', async () => {
    const { useCase, record } = build();

    await useCase.execute({ action: 'auth.login' });

    const entry = (record.mock.calls[0] as [AuditEntry])[0];
    expect(entry.userId).toBeNull();
    expect(entry.targetType).toBeNull();
    expect(entry.targetId).toBeNull();
    expect(entry.metadata).toBeNull();
  });

  it('propagates repository failures to the caller', async () => {
    const { useCase } = build(jest.fn().mockRejectedValue(new Error('db down')));

    await expect(useCase.execute({ action: 'auth.login' })).rejects.toThrow('db down');
  });

  it('rejects an invalid action without touching the repository', async () => {
    const { useCase, record } = build();

    await expect(useCase.execute({ action: 'nope' })).rejects.toThrow(/Invalid audit action/);
    expect(record).not.toHaveBeenCalled();
  });
});
