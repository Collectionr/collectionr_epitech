import { Module } from '@nestjs/common';
import { HealthController } from './interface/controllers/HealthController';
import { GetHealthStatusUseCase } from './application/use-cases/GetHealthStatusUseCase';
import { SystemClockService } from './infrastructure/services/SystemClockService';
import { CLOCK_SERVICE } from './application/ports/IClockService';

@Module({
  controllers: [HealthController],
  providers: [
    GetHealthStatusUseCase,
    {
      provide: CLOCK_SERVICE,
      useClass: SystemClockService,
    },
  ],
})
export class HealthModule {}
