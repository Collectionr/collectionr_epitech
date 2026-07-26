import { Module } from '@nestjs/common';
import { HealthController } from './interface/controllers/HealthController';
import { GetHealthStatusUseCase } from './application/use-cases/GetHealthStatusUseCase';
import { SystemClockService } from './infrastructure/services/SystemClockService';
import { PostgresHealthIndicator } from './infrastructure/services/PostgresHealthIndicator';
import { RedisHealthIndicator } from './infrastructure/services/RedisHealthIndicator';
import { CLOCK_SERVICE } from './application/ports/IClockService';
import { HEALTH_INDICATORS } from './application/ports/IHealthIndicator';
import type { IHealthIndicator } from './application/ports/IHealthIndicator';
import { PostgresModule } from '../../shared/infrastructure/database/PostgresModule';
import { RedisModule } from '../../shared/infrastructure/redis/RedisModule';

@Module({
  imports: [PostgresModule, RedisModule],
  controllers: [HealthController],
  providers: [
    GetHealthStatusUseCase,
    {
      provide: CLOCK_SERVICE,
      useClass: SystemClockService,
    },
    PostgresHealthIndicator,
    RedisHealthIndicator,
    {
      provide: HEALTH_INDICATORS,
      inject: [PostgresHealthIndicator, RedisHealthIndicator],
      useFactory: (
        database: PostgresHealthIndicator,
        cache: RedisHealthIndicator,
      ): IHealthIndicator[] => [database, cache],
    },
  ],
})
export class HealthModule {}
