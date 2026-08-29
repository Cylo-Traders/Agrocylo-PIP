import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Refuses a `file:`-scheme DATABASE_URL (the local SQLite default) in
 * production, so a misconfigured deploy fails fast at startup instead of
 * silently running against a throwaway local file.
 */
export function assertDatabaseUrlAllowed(url: string, nodeEnv: string): void {
  if (nodeEnv === 'production' && url.startsWith('file:')) {
    throw new Error(
      `DATABASE_URL resolves to a local file ("${url}"), which is not allowed when NODE_ENV=production. Set DATABASE_URL to a real database connection string.`,
    );
  }
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PrismaClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('db.url')!;
        const nodeEnv = config.get<string>('app.nodeEnv')!;
        assertDatabaseUrlAllowed(url, nodeEnv);
        const adapter = new PrismaLibSql({ url });
        return new PrismaClient({ adapter });
      },
    },
  ],
  exports: [PrismaClient],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(private readonly prisma: PrismaClient) {}

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
