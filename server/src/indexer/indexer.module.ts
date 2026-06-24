import { Module } from '@nestjs/common';
import { LoggerModule } from '../common/logger/logger.module';
import { SorobanEventListenerService } from './soroban-event-listener.service';

/**
 * Indexer Module
 *
 * Responsible for listening to and processing blockchain events.
 */
@Module({
  imports: [LoggerModule],
  providers: [SorobanEventListenerService],
  exports: [SorobanEventListenerService],
})
export class IndexerModule {}
