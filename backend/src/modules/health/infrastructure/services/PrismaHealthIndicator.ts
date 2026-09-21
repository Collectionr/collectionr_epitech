import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { DependencyHealth } from '../../domain/entities/HealthStatus';
import type { IHealthIndicator } from '../../application/ports/IHealthIndicator';
import { PRISMA_CLIENT } from '../../../../shared/infrastructure/database/PrismaModule';
import { runWithTimeout } from '../../../../shared/infrastructure/RunWithTimeout';
import { HEALTH_CHECK_TIMEOUT_MS } from '../../../../shared/config/AppConstants';

@Injectable()
export class PrismaHealthIndicator implements IHealthIndicator {
  constructor(@Inject(PRISMA_CLIENT) private readonly prismaClient: PrismaClient) {}

  async check(): Promise<DependencyHealth> {
    const startedAt = Date.now();

    try {
      await runWithTimeout(
        this.prismaClient.$queryRaw`SELECT 1`,
        HEALTH_CHECK_TIMEOUT_MS,
        'PostgreSQL',
      );
      return new DependencyHealth('database', 'up', Date.now() - startedAt);
    } catch {
      return new DependencyHealth('database', 'down', null);
    }
  }
}
