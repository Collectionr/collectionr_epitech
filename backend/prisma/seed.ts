import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

// No business models exist yet (see COLLR-412 scope). Seed data (demo users,
// collections, catalogue) will be added incrementally as the corresponding
// functional epics land, per COLLR-438. For now this only confirms the
// connection is wired correctly.
async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
  const prismaClient = new PrismaClient({ adapter });

  try {
    await prismaClient.$queryRaw`SELECT 1`;
    console.log(
      'Seed connection OK — no seed data yet (COLLR-438: to be filled in per functional epic).',
    );
  } finally {
    await prismaClient.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
