import { Inject, Logger, Module } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const POSTGRES_POOL = 'POSTGRES_POOL';

/**
 * Minimal PostgreSQL connection pool, dedicated to the application core (healthcheck).
 * Full ORM tooling (Prisma) is carried by Feature COLLR-412: this pool
 * can then be replaced without impacting the port's consumers.
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
        pool.on('error', (error) => logger.error(`PostgreSQL pool error: ${error.message}`));
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
