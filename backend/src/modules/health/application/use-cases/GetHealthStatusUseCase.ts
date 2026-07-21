import { Inject, Injectable } from '@nestjs/common';
import { HealthStatus } from '../../domain/entities/HealthStatus';
import { CLOCK_SERVICE } from '../ports/IClockService';
import type { IClockService } from '../ports/IClockService';

@Injectable()
export class GetHealthStatusUseCase {
  constructor(@Inject(CLOCK_SERVICE) private readonly clockService: IClockService) {}

  execute(): HealthStatus {
    return new HealthStatus('ok', this.clockService.now());
  }
}
