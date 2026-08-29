import { Controller, Get, Param, Query } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { ListCampaignsQueryDto } from './dto/list-campaigns.query.dto';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  list(@Query() query: ListCampaignsQueryDto) {
    return this.campaigns.list(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.campaigns.detail(id);
  }

  @Get(':id/activity')
  activity(@Param('id') id: string) {
    return this.campaigns.activity(id);
  }
}
