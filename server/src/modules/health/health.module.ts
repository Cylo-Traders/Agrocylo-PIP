import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from '../../database/database.module';
import { IndexerModule } from '../../indexer/indexer.module';
import { HealthController } from './health.controller';
import {
  DatabaseHealthIndicator,
  SorobanRpcHealthIndicator,
  IndexerStateHealthIndicator,
} from './health.controller';

@Module({
  imports: [TerminusModule, DatabaseModule, IndexerModule],
  controllers: [HealthController],
  providers: [
    DatabaseHealthIndicator,
    SorobanRpcHealthIndicator,
    IndexerStateHealthIndicator,
  ],
  exports: [
    DatabaseHealthIndicator,
    SorobanRpcHealthIndicator,
    IndexerStateHealthIndicator,
  ],
})
export class HealthModule {}
