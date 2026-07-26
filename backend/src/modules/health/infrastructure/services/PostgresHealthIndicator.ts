import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DependencyHealth } from '../../domain/entities/HealthStatus';
import type { IHealthIndicator } from '../../application/ports/IHealthIndicator';
import { POSTGRES_POOL } from '../../../../shared/infrastructure/database/PostgresModule';
import { runWithTimeout } from '../../../../shared/infrastructure/RunWithTimeout';

const HEALTH_CHECK_TIMEOUT_MS = 2000;

@Injectable()
export class PostgresHealthIndicator implements IHealthIndicator {
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  async check(): Promise<DependencyHealth> {
    const startedAt = Date.now();

    try {
      await runWithTimeout(this.pool.query('SELECT 1'), HEALTH_CHECK_TIMEOUT_MS, 'PostgreSQL');
      return new DependencyHealth('database', 'up', Date.now() - startedAt);
    } catch {
      return new DependencyHealth('database', 'down', null);
    }
  }
}
