import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { AuditEntry } from '../../domain/entities/AuditEntry';
import { PrismaAuditLogRepository } from './PrismaAuditLogRepository';

function buildEntry(metadata: AuditEntry['metadata']): AuditEntry {
  return AuditEntry.record({
    userId: '0b1f6c1e-6c1e-4b1e-8b1e-1b1e6c1e4b1e',
    action: 'collection.create',
    targetType: 'collection',
    targetId: '7d444840-9dc0-41d5-bf4a-0e4c0b5c1e11',
    metadata,
    occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    retentionDays: 90,
  });
}

describe('PrismaAuditLogRepository', () => {
  it('inserts the entry with every column', async () => {
    const create = jest.fn().mockResolvedValue({});
    const repository = new PrismaAuditLogRepository({
      auditLog: { create },
    } as unknown as PrismaClient);

    await repository.record(buildEntry({ name: 'Base Set' }));

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: '0b1f6c1e-6c1e-4b1e-8b1e-1b1e6c1e4b1e',
        action: 'collection.create',
        targetType: 'collection',
        targetId: '7d444840-9dc0-41d5-bf4a-0e4c0b5c1e11',
        metadata: { name: 'Base Set' },
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    });
  });

  it('leaves the metadata column NULL when there is none', async () => {
    const create = jest.fn().mockResolvedValue({});
    const repository = new PrismaAuditLogRepository({
      auditLog: { create },
    } as unknown as PrismaClient);

    await repository.record(buildEntry(null));

    const call = create.mock.calls[0] as [{ data: { metadata?: unknown } }];
    expect(call[0].data.metadata).toBeUndefined();
  });

  it('propagates database errors', async () => {
    const repository = new PrismaAuditLogRepository({
      auditLog: { create: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) },
    } as unknown as PrismaClient);

    await expect(repository.record(buildEntry(null))).rejects.toThrow('ECONNREFUSED');
  });
});
