import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7: the connection is no longer declared in schema.prisma (see .claude/errors/prisma7_url_in_schema.md).

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
