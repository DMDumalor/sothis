import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 moved the CLI's connection details (used by `migrate`/`db push`/
 * `studio`) out of schema.prisma and into this file. This is separate from
 * how the application talks to the database at runtime: PrismaService
 * (src/prisma/prisma.service.ts) still constructs the client with the
 * `@prisma/adapter-pg` driver adapter, so the running app never needs
 * Prisma's native query engine — only these CLI commands read this file.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node -r tsconfig-paths/register prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
