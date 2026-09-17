import { Module } from '@nestjs/common';
import { HealthController } from './interface/controllers/HealthController';
import { GetHealthStatusUseCase } from './application/use-cases/GetHealthStatusUseCase';
import { SystemClockService } from './infrastructure/services/SystemClockService';
import { PrismaHealthIndicator } from './infrastructure/services/PrismaHealthIndicator';
import { RedisHealthIndicator } from './infrastructure/services/RedisHealthIndicator';
import { CLOCK_SERVICE } from './application/ports/IClockService';
import { HEALTH_INDICATORS } from './application/ports/IHealthIndicator';
import type { IHealthIndicator } from './application/ports/IHealthIndicator';
import { PrismaModule } from '../../shared/infrastructure/database/PrismaModule';
import { RedisModule } from '../../shared/infrastructure/redis/RedisModule';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [HealthController],
  providers: [
    GetHealthStatusUseCase,
    {
      provide: CLOCK_SERVICE,
      useClass: SystemClockService,
    },
    PrismaHealthIndicator,
    RedisHealthIndicator,
    {
      provide: HEALTH_INDICATORS,
      inject: [PrismaHealthIndicator, RedisHealthIndicator],
      useFactory: (
        database: PrismaHealthIndicator,
        cache: RedisHealthIndicator,
      ): IHealthIndicator[] => [database, cache],
    },
  ],
})
export class HealthModule {}
