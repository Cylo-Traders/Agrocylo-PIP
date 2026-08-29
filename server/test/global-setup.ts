import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * Runs once before the e2e suite. Brings the Postgres database named by
 * `DATABASE_URL` up to the latest schema so every spec can assume its tables
 * exist. `prisma migrate deploy` is idempotent, so this is a no-op when CI has
 * already run the migration step.
 */
export default function globalSetup(): void {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
}
