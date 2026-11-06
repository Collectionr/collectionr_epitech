import { Inject, Logger, Module } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CONNECT_TIMEOUT_MS } from '../../config/AppConstants';
import { runWithTimeout } from '../RunWithTimeout';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Shared Redis client (ioredis).
 * - connects at boot and boot waits (bounded) for readiness: with the offline queue disabled, a
 *   command sent before the connection is up fails, so the first requests after a start (login,
 *   register) would be refused with a 503 for no real outage
 * - enableOfflineQueue disabled: commands fail immediately if
 *   Redis is unavailable (the healthcheck stays fast and reliable)
 * - automatic background reconnection with capped backoff
 */
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        const logger = new Logger('RedisClient');
        const client = new Redis(configService.get<string>('REDIS_URL', 'redis://localhost:6379'), {
          lazyConnect: false,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          retryStrategy: (times) => Math.min(times * 200, 2000),
        });
        client.on('error', (error) => logger.warn(`Redis connection error: ${error.message}`));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('RedisClient');

  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  async onModuleInit(): Promise<void> {
    if (this.redisClient.status === 'ready') {
      return;
    }
    try {
      await runWithTimeout(
        new Promise<void>((resolve) => this.redisClient.once('ready', () => resolve())),
        REDIS_CONNECT_TIMEOUT_MS,
        'Redis',
      );
    } catch {
      this.logger.warn(
        'Redis is not reachable yet; requests needing it will be refused until it is',
      );
    }
  }

  onModuleDestroy(): void {
    this.redisClient.disconnect();
  }
}
