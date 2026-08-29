import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  providers: [
    {
      provide: PrismaClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('db.url');
        if (!url) {
          throw new Error('DATABASE_URL is not defined in configuration');
        }
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
