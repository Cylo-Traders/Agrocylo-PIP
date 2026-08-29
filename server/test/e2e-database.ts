import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// Child tables first so TRUNCATE ... CASCADE has nothing to complain about even
// if foreign-key checks are strict.
const TABLES = [
  'Investment',
  'Tranche',
  'Dispute',
  'Order',
  'Transaction',
  'Campaign',
  'User',
  'IndexerCursor',
];

/**
 * A `PrismaClient` bound to `DATABASE_URL` through the pg driver adapter — the
 * same wiring `DatabaseModule` uses, so seeding and assertions hit exactly the
 * database the application under test does.
 */
export function createTestPrismaClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

/**
 * Empties every table so a spec starts from a known-clean database. e2e specs
 * share one Postgres schema and jest runs them serially (`--runInBand`), so a
 * reset in `beforeAll` is enough to keep files from seeing each other's rows.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const list = TABLES.map((table) => `"${table}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
  );
}
