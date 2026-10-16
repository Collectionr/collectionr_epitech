import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { ROLE_NAMES } from '../src/shared/config/AppConstants';

// Reference data only, idempotent: safe to run on every environment and more than once.
// Demo data (users, collections, catalogue) will be added per functional epic (COLLR-438).
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
  } finally {
    await prismaClient.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
