import { Inject, Logger, Module } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const POSTGRES_POOL = 'POSTGRES_POOL';

/**
 * Pool de connexions PostgreSQL minimal, dédié au socle applicatif (healthcheck).
 * L'outillage ORM complet (Prisma) est porté par la Feature COLLR-412 : ce pool
 * pourra alors être remplacé sans impacter les consommateurs du port.
 */
@Module({
  providers: [
    {
      provide: POSTGRES_POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Pool => {
        const logger = new Logger('PostgresPool');
        const pool = new Pool({
          connectionString: configService.get<string>('DATABASE_URL'),
          max: 5,
          connectionTimeoutMillis: 2000,
        });
        pool.on('error', (error) => logger.error(`Erreur du pool PostgreSQL : ${error.message}`));
        return pool;
      },
    },
  ],
  exports: [POSTGRES_POOL],
})
export class PostgresModule implements OnModuleDestroy {
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
