import { Module } from '@nestjs/common';
import { CampaignEventsGateway } from './campaign-events.gateway';
import { RealtimeEventsService } from './realtime-events.service';
import { WsAuthGuard } from './ws-auth.guard';

@Module({
  providers: [CampaignEventsGateway, RealtimeEventsService, WsAuthGuard],
  exports: [RealtimeEventsService],
})
export class WebsocketModule {}
