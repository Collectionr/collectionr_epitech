import { Controller, Get, HttpStatus, Res, VERSION_NEUTRAL } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { GetHealthStatusUseCase } from '../../application/use-cases/GetHealthStatusUseCase';
import { HealthResponseDto } from '../../application/dtos/HealthResponseDto';

@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly getHealthStatusUseCase: GetHealthStatusUseCase) {}

  // Accès natif Fastify nécessaire (passthrough) : le code HTTP dépend de l'état
  // agrégé — 200 si tout est up, 503 sinon — consommé par les probes K3s.
  // La sérialisation de la réponse reste gérée par NestJS.
  @Get()
  async check(@Res({ passthrough: true }) reply: FastifyReply): Promise<HealthResponseDto> {
    const healthStatus = await this.getHealthStatusUseCase.execute();

    reply.status(healthStatus.isHealthy() ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return HealthResponseDto.fromDomain(healthStatus);
  }
}
