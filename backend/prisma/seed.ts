import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { ROLE_NAMES } from '../src/shared/config/AppConstants';
import { seedCatalogue } from './catalogue/SeedCatalogue';
import { seedDemoData, shouldSeedDemoData } from './demo/SeedDemoData';

// Reference data (roles, catalogue) is idempotent and safe on every environment. Demo data (users and
// collections, COLLR-688) is idempotent too but skipped in production: the demo accounts have a known password.
// Permissions and role_permissions are not seeded: the permission list is not defined yet (COLLR-449).
async function seedRoles(prismaClient: PrismaClient): Promise<void> {
  for (const name of ROLE_NAMES) {
    await prismaClient.role.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`Roles seeded: ${ROLE_NAMES.join(', ')}.`);
}

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
  const prismaClient = new PrismaClient({ adapter });

  try {
    await seedRoles(prismaClient);
    const { sets, cards, variants } = await seedCatalogue(prismaClient);
    console.log(`Catalogue seeded: ${sets} sets, ${cards} cards, ${variants} variants.`);

    if (shouldSeedDemoData(process.env['NODE_ENV'])) {
      const demo = await seedDemoData(prismaClient, process.env['SEED_DEMO_PASSWORD']);
      console.log(
        `Demo data seeded (new rows only): ${demo.users} users, ${demo.collections} collections, ${demo.cardEntries} card entries.`,
      );
    } else {
      console.log('Demo data skipped: NODE_ENV is production.');
    }
  } finally {
    await prismaClient.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
