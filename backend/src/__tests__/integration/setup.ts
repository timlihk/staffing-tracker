import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

export async function setupTestDatabase() {
  // Run migrations for test database
  try {
    execSync('npx prisma migrate deploy', {
      env: {
        ...process.env,
        DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
      },
      stdio: 'ignore',
    });
  } catch (error) {
    console.warn('Migration failed - database may already be set up');
  }

  // Clean all tables
  await cleanDatabase();
}

export async function cleanDatabase() {
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  for (const { tablename } of tablenames) {
    if (tablename !== '_prisma_migrations') {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
      } catch (error) {
        console.log(`Could not truncate ${tablename}, you may need to do it manually.`);
      }
    }
  }
}

export async function teardownTestDatabase() {
  await cleanDatabase();
  await prisma.$disconnect();
}

export { prisma };
