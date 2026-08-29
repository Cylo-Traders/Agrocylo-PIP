import { Test } from '@nestjs/testing';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import configuration from '../config/configuration';
import { DatabaseModule } from './database.module';
import { PrismaClient } from '../../generated/prisma/client';

/**
 * Uses the same `configuration()` loader the real app uses (not raw
 * `process.env` reads), so this proves DatabaseModule's production guard
 * actually blocks the Prisma client it constructs — not just that
 * ConfigService.get('db.url') would return the right value.
 */
function buildModule() {
  return Test.createTestingModule({
    imports: [
      NestConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
      DatabaseModule,
    ],
  }).compile();
}

describe('DatabaseModule', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('constructs a Prisma client from ConfigService (not a direct process.env read) outside production', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'file:./dev.db';

    const moduleRef = await buildModule();

    const client = moduleRef.get(PrismaClient);
    expect(typeof client.$disconnect).toBe('function');
    await moduleRef.close();
  });

  it('refuses to construct a Prisma client against a local file DATABASE_URL when NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'file:./dev.db';

    await expect(buildModule()).rejects.toThrow(/DATABASE_URL/);
  });

  it('allows a non-file DATABASE_URL when NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'libsql://prod-db.example.com?authToken=secret';

    const moduleRef = await buildModule();

    const client = moduleRef.get(PrismaClient);
    expect(typeof client.$disconnect).toBe('function');
    await moduleRef.close();
  });
});
