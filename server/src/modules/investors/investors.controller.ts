import { Controller, Get, Param } from '@nestjs/common';
import { InvestorsService } from './investors.service';

@Controller('investors')
export class InvestorsController {
  constructor(private readonly investors: InvestorsService) {}

  @Get(':address/portfolio')
  portfolio(@Param('address') address: string) {
    return this.investors.portfolio(address);
  }
}
