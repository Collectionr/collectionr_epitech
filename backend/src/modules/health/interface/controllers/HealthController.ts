import { Controller, Get, HttpStatus, Res, VERSION_NEUTRAL } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { GetHealthStatusUseCase } from '../../application/use-cases/GetHealthStatusUseCase';
import { HealthResponseDto } from '../../application/dtos/HealthResponseDto';

@ApiTags('Health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly getHealthStatusUseCase: GetHealthStatusUseCase) {}

  // Accès natif Fastify nécessaire (passthrough) : le code HTTP dépend de l'état
  // agrégé — 200 si tout est up, 503 sinon — consommé par les probes K3s.
  // La sérialisation de la réponse reste gérée par NestJS.
  @Get()
  @ApiOperation({ summary: "État de l'application et de ses dépendances (PostgreSQL, Redis)" })
  @ApiOkResponse({
    description: 'Toutes les dépendances sont disponibles',
    type: HealthResponseDto,
  })
  @ApiServiceUnavailableResponse({ description: 'Au moins une dépendance est indisponible' })
  async check(@Res({ passthrough: true }) reply: FastifyReply): Promise<HealthResponseDto> {
    const healthStatus = await this.getHealthStatusUseCase.execute();

    reply.status(healthStatus.isHealthy() ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return HealthResponseDto.fromDomain(healthStatus);
  }
}
