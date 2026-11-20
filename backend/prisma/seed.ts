import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { ROLE_NAMES } from '../src/shared/config/AppConstants';
import { seedCatalogue } from './catalogue/SeedCatalogue';
import { seedDemoData, shouldSeedDemoData } from './demo/SeedDemoData';

// Reference data (roles, catalogue) is idempotent and safe on every environment. Demo data (users and
// collections) is idempotent too but opt-in/out with SEED_DEMO_DATA (see shouldSeedDemoData); without it, skipped
// in production: the demo accounts have a known password.
// Permissions and role_permissions are not seeded: the permission list is not defined yet (COLLR-449).
async function seedRoles(prismaClient: PrismaClient): Promise<void> {
  for (const name of ROLE_NAMES) {
    await prismaClient.role.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`Roles seeded: ${ROLE_NAMES.join(', ')}.`);
}

async function main(): Promise<void> {
  // Decided first: an invalid SEED_DEMO_DATA must stop the seed before it writes anything.
  const withDemoData = shouldSeedDemoData(process.env['NODE_ENV'], process.env['SEED_DEMO_DATA']);

  const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
  const prismaClient = new PrismaClient({ adapter });

  try {
    await seedRoles(prismaClient);
    const { sets, cards, variants } = await seedCatalogue(prismaClient);
    console.log(`Catalogue seeded: ${sets} sets, ${cards} cards, ${variants} variants.`);

    if (withDemoData) {
      const demo = await seedDemoData(prismaClient, process.env['SEED_DEMO_PASSWORD']);
      console.log(
        `Demo data seeded (new rows only): ${demo.users} users, ${demo.collections} collections, ${demo.cardEntries} card entries.`,
      );
    } else {
      console.log(
        'Demo data skipped (SEED_DEMO_DATA=false, or NODE_ENV=production without SEED_DEMO_DATA=true).',
      );
    }
  } finally {
    await prismaClient.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
