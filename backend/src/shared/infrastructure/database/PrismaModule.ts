import { Inject, Module } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client.js';

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
        const adapter = new PrismaPg({
          connectionString: configService.get<string>('DATABASE_URL'),
        });
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
