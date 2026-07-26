import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { GetHealthStatusUseCase } from '../../application/use-cases/GetHealthStatusUseCase';
import { HealthResponseDto } from '../../application/dtos/HealthResponseDto';

@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly getHealthStatusUseCase: GetHealthStatusUseCase) {}

  @Get()
  check(): HealthResponseDto {
    const healthStatus = this.getHealthStatusUseCase.execute();
    return HealthResponseDto.fromDomain(healthStatus);
  }
}
