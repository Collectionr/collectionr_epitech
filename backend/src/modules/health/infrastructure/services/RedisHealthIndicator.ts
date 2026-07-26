import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { DependencyHealth } from '../../domain/entities/HealthStatus';
import type { IHealthIndicator } from '../../application/ports/IHealthIndicator';
import { REDIS_CLIENT } from '../../../../shared/infrastructure/redis/RedisModule';
import { runWithTimeout } from '../../../../shared/infrastructure/RunWithTimeout';

const HEALTH_CHECK_TIMEOUT_MS = 2000;

@Injectable()
export class RedisHealthIndicator implements IHealthIndicator {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  async check(): Promise<DependencyHealth> {
    const startedAt = Date.now();

    try {
      // Client en lazyConnect : on établit la connexion à la première vérification.
      if (this.redisClient.status === 'wait' || this.redisClient.status === 'end') {
        await runWithTimeout(this.redisClient.connect(), HEALTH_CHECK_TIMEOUT_MS, 'Redis');
      }

      await runWithTimeout(this.redisClient.ping(), HEALTH_CHECK_TIMEOUT_MS, 'Redis');
      return new DependencyHealth('cache', 'up', Date.now() - startedAt);
    } catch {
      return new DependencyHealth('cache', 'down', null);
    }
  }
}
