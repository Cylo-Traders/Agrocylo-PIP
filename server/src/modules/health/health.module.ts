import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { IndexerHealthIndicator } from './indicators/indexer-health.indicator';
import { IndexerModule } from '../../indexer/indexer.module';

@Module({
  imports: [TerminusModule, ConfigModule, IndexerModule],
  controllers: [HealthController],
  providers: [IndexerHealthIndicator],
})
export class HealthModule {}
