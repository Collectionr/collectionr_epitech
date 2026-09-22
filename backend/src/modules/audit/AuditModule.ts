import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RecordAuditEntryUseCase } from './application/use-cases/RecordAuditEntryUseCase';
import { AUDIT_LOG_REPOSITORY } from './application/ports/IAuditLogRepository';
import { AUDIT_RETENTION_DAYS } from './application/ports/AuditRetention';
import { PrismaAuditLogRepository } from './infrastructure/repositories/PrismaAuditLogRepository';
import { AuditInterceptor } from './interface/interceptors/AuditInterceptor';
import { PrismaModule } from '../../shared/infrastructure/database/PrismaModule';

/**
 * Audit trail. The interceptor is global but only acts on @Audit-annotated
 * handlers; other modules can also inject RecordAuditEntryUseCase directly.
 */
@Module({
  imports: [PrismaModule],
  providers: [
    RecordAuditEntryUseCase,
    { provide: AUDIT_LOG_REPOSITORY, useClass: PrismaAuditLogRepository },
    {
      provide: AUDIT_RETENTION_DAYS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): number =>
        configService.get<number>('AUDIT_LOG_RETENTION_DAYS', 90),
    },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [RecordAuditEntryUseCase],
})
export class AuditModule {}
