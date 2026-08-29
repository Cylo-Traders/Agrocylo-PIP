import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  ConfigModule as NestConfigModule,
  ConfigService,
} from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { LoggerModule } from './common/logger/logger.module';
import { HealthModule } from './modules/health/health.module';
import { IndexerModule } from './indexer/indexer.module';
import { DatabaseModule } from './database/database.module';
import { WebsocketModule } from './websocket/websocket.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { InvestorsModule } from './modules/investors/investors.module';

/**
 * Root application module. Feature modules are registered here as the platform
 * grows (e.g. database, indexer, websocket gateways).
 */
@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    ThrottlerModule.forRootAsync({
      imports: [NestConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('throttle.ttlMs') ?? 60000,
            limit: config.get<number>('throttle.limit') ?? 100,
          },
        ],
      }),
    }),
    HealthModule,
    DatabaseModule,
    WebsocketModule,
    IndexerModule,
    CampaignsModule,
    InvestorsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
