import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const KNOWN_STATUSES = [
  'Active',
  'Funding',
  'Funded',
  'InProduction',
  'Harvested',
  'Disputed',
  'Resolved',
  'Settled',
  'Failed',
];

/** Query params for `GET /campaigns`. */
export class ListCampaignsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsIn(KNOWN_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  farmer?: string;
}
