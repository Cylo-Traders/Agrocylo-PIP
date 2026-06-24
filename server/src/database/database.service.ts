import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('database.url'),
        },
      },
    });
    this.logger.setContext(DatabaseService.name);
  }

  async onModuleInit(): Promise<void> {
    const shouldConnect =
      this.configService.get<boolean>('database.connectOnStartup') ?? true;

    if (!shouldConnect) {
      this.logger.warn('Database startup connection disabled');
      return;
    }

    await this.$connect();
    this.logger.info('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.info('Database connection closed');
  }
}
