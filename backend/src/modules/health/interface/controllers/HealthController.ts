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

  // Native Fastify access required (passthrough): the HTTP status depends on the
  // aggregated state — 200 if everything is up, 503 otherwise — consumed by K3s probes.
  // Response serialization stays handled by NestJS.
  @Get()
  @ApiOperation({ summary: 'Application and dependency status (PostgreSQL, Redis)' })
  @ApiOkResponse({
    description: 'All dependencies are available',
    type: HealthResponseDto,
  })
  @ApiServiceUnavailableResponse({ description: 'At least one dependency is unavailable' })
  async check(@Res({ passthrough: true }) reply: FastifyReply): Promise<HealthResponseDto> {
    const healthStatus = await this.getHealthStatusUseCase.execute();

    reply.status(healthStatus.isHealthy() ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return HealthResponseDto.fromDomain(healthStatus);
  }
}
