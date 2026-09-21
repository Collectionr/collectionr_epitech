import { Inject, Injectable } from '@nestjs/common';
import { HealthStatus } from '../../domain/entities/HealthStatus';
import { CLOCK_SERVICE } from '../ports/IClockService';
import type { IClockService } from '../ports/IClockService';
import { HEALTH_INDICATORS } from '../ports/IHealthIndicator';
import type { IHealthIndicator } from '../ports/IHealthIndicator';

@Injectable()
export class GetHealthStatusUseCase {
  constructor(
    @Inject(CLOCK_SERVICE) private readonly clockService: IClockService,
    @Inject(HEALTH_INDICATORS) private readonly healthIndicators: IHealthIndicator[],
  ) {}

  async execute(): Promise<HealthStatus> {
    const dependencies = await Promise.all(
      this.healthIndicators.map((indicator) => indicator.check()),
    );

    return HealthStatus.fromDependencies(this.clockService.now(), dependencies);
  }
}
