import { Inject, Logger, Module } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client.js';
import { DATABASE_CONNECTION_TIMEOUT_MS } from '../../config/AppConstants';

export const PRISMA_CLIENT = 'PRISMA_CLIENT';

/**
 * Shared Prisma client, connected via the @prisma/adapter-pg driver adapter
 * (Prisma 7: the connection string is no longer declared in schema.prisma,
 * see .claude/errors/prisma7_url_in_schema.md).
 */
@Module({
  providers: [
    {
      provide: PRISMA_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): PrismaClient => {
        const logger = new Logger('PrismaPool');
        const adapter = new PrismaPg(
          {
            connectionString: configService.get<string>('DATABASE_URL'),
            max: configService.get<number>('DATABASE_POOL_MAX', 5),
            connectionTimeoutMillis: DATABASE_CONNECTION_TIMEOUT_MS,
          },
          { onPoolError: (error) => logger.error(`PostgreSQL pool error: ${error.message}`) },
        );
        return new PrismaClient({ adapter });
      },
    },
  ],
  exports: [PRISMA_CLIENT],
})
export class PrismaModule implements OnModuleDestroy {
  constructor(@Inject(PRISMA_CLIENT) private readonly prismaClient: PrismaClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.prismaClient.$disconnect();
  }
}
