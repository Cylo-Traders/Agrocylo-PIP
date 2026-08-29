import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseModule } from './database.module';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from '../config/env.validation';
import configuration from '../config/configuration';
import { PrismaClient } from '../../generated/prisma/client';

describe('DatabaseModule', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should prevent module initialization in production when DATABASE_URL uses the file: scheme', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'file:./dev.db';

    await expect(
      Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
            validationSchema: envValidationSchema,
          }),
          DatabaseModule,
        ],
      }).compile(),
    ).rejects.toThrow(/"DATABASE_URL" cannot use the "file:" scheme in production/);
  });

  it('should initialize successfully in production when DATABASE_URL is valid', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'libsql://example.turso.io';

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          validationSchema: envValidationSchema,
        }),
        DatabaseModule,
      ],
    }).compile();

    const prismaClient = moduleRef.get<PrismaClient>(PrismaClient);
    expect(prismaClient).toBeDefined();
    await moduleRef.close();
  });
});
