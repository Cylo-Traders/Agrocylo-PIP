import { Module } from '@nestjs/common';
import { SorobanEventListenerService } from './soroban-event-listener.service';
import { EventParserService } from './parsers/event-parser.service';
import { WebsocketModule } from '../websocket/websocket.module';
import { TransactionRetentionService } from './transaction-retention.service';

@Module({
  imports: [WebsocketModule],
  providers: [SorobanEventListenerService, EventParserService, TransactionRetentionService],
  exports: [SorobanEventListenerService, EventParserService, TransactionRetentionService],
})
export class IndexerModule {}

