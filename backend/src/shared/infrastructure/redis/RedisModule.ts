import { Inject, Logger, Module } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Shared Redis client (ioredis).
 * - lazyConnect: no connection until a command is issued
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
          lazyConnect: true,
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
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  onModuleDestroy(): void {
    this.redisClient.disconnect();
  }
}
