import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '../../../../generated/prisma/client.js';
import type { AuditEntry } from '../../domain/entities/AuditEntry';
import type { IAuditLogRepository } from '../../application/ports/IAuditLogRepository';
import { PRISMA_CLIENT } from '../../../../shared/infrastructure/database/PrismaModule';

@Injectable()
export class PrismaAuditLogRepository implements IAuditLogRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prismaClient: PrismaClient) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prismaClient.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        // undefined leaves the column NULL (Prisma rejects a raw null on a Json field).
        metadata: entry.metadata ?? undefined,
        timestamp: entry.timestamp,
        expiresAt: entry.expiresAt,
      } satisfies Prisma.AuditLogUncheckedCreateInput,
    });
  }
}
