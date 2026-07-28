import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { LoggerModule } from './common/logger/logger.module';
import { HealthModule } from './modules/health/health.module';
import { IndexerModule } from './indexer/indexer.module';
import { DatabaseModule } from './database/database.module';

/**
 * Root application module. Feature modules are registered here as the platform
 * grows (e.g. database, indexer, websocket gateways).
 */
@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    HealthModule,
    DatabaseModule,
    IndexerModule,
  ],
})
export class AppModule {}
