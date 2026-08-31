import { Module } from '@nestjs/common';
import { SorobanEventListenerService } from './soroban-event-listener.service';
import { EventParserService } from './parsers/event-parser.service';
import { EventRetentionService } from './retention/event-retention.service';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [WebsocketModule],
  providers: [
    SorobanEventListenerService,
    EventParserService,
    EventRetentionService,
  ],
  exports: [
    SorobanEventListenerService,
    EventParserService,
    EventRetentionService,
  ],
})
export class IndexerModule {}
