import { Inject, Logger, Module } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Client Redis partagé (ioredis).
 * - lazyConnect : aucune connexion tant qu'aucune commande n'est émise
 * - enableOfflineQueue désactivé : les commandes échouent immédiatement si
 *   Redis est indisponible (le healthcheck reste rapide et fiable)
 * - reconnexion automatique en arrière-plan avec backoff plafonné
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
        client.on('error', (error) => logger.warn(`Connexion Redis en erreur : ${error.message}`));
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
