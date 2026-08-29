import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '../generated/prisma/client';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');

/**
 * Materialise the full Prisma schema on a fresh SQLite database by replaying
 * every checked-in migration in filename order. CI runs the e2e suite against
 * an unmigrated database file, so specs that need real tables call this first.
 *
 * The libsql adapter executes only the first statement of a multi-statement
 * string, so each migration is applied one statement at a time.
 */
export async function applyMigrations(client: PrismaClient): Promise<void> {
  const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const dir of dirs) {
    const sql = readFileSync(
      path.join(MIGRATIONS_DIR, dir, 'migration.sql'),
      'utf8',
    );
    const statements = sql
      .split(';')
      .map((statement) => statement.trim())
      .filter(
        (statement) => statement.replace(/--.*$/gm, '').trim().length > 0,
      );
    for (const statement of statements) {
      await client.$executeRawUnsafe(statement);
    }
  }
}
