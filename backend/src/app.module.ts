import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { validateEnvironment } from './shared/config/ValidateEnvironment';
import { createLoggerOptions } from './shared/infrastructure/logging/CreateLoggerOptions';
import { AllExceptionsFilter } from './shared/interface/filters/AllExceptionsFilter';
import { HealthModule } from './modules/health/HealthModule';
import { AuditModule } from './modules/audit/AuditModule';
import { AuditContextGuard } from './modules/audit/interface/guards/AuditContextGuard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => createLoggerOptions(configService),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: seconds(configService.get<number>('THROTTLE_TTL', 60)),
            limit: configService.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),
    HealthModule,
    AuditModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Must run before ThrottlerGuard (and any future auth/rbac guard): it only
    // stashes @Audit metadata on the request so AllExceptionsFilter can record
    // a rejection that never reaches AuditInterceptor (ADR-011). Multiple
    // APP_GUARD providers run in the order they are declared here.
    { provide: APP_GUARD, useClass: AuditContextGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
