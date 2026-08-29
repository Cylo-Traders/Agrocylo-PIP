import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '../../../generated/prisma/client';
import { ListCampaignsQueryDto } from './dto/list-campaigns.query.dto';

/** JSON has no BigInt; every BigInt column is transported as a decimal string. */
function numeric(value: bigint | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toString();
}

function toCampaignSummary(campaign: {
  id: string;
  farmer: string;
  title: string;
  description: string;
  targetAmount: bigint | null;
  tokenAddress: string | null;
  deadline: bigint | null;
  status: string;
  totalFunded: bigint;
  escrowContract: string;
  trancheCount: number | null;
  harvestOutcome: string | null;
  harvestReportedAt: bigint | null;
  refundable: bigint;
  returnable: bigint;
  createdAt: bigint;
  updatedAt: Date;
}) {
  return {
    id: campaign.id,
    farmer: campaign.farmer,
    title: campaign.title,
    description: campaign.description,
    targetAmount: numeric(campaign.targetAmount),
    tokenAddress: campaign.tokenAddress,
    deadline: numeric(campaign.deadline),
    status: campaign.status,
    totalFunded: numeric(campaign.totalFunded) as string,
    escrowContract: campaign.escrowContract,
    trancheCount: campaign.trancheCount,
    harvestOutcome: campaign.harvestOutcome,
    harvestReportedAt: numeric(campaign.harvestReportedAt),
    refundable: numeric(campaign.refundable) as string,
    returnable: numeric(campaign.returnable) as string,
    createdAt: numeric(campaign.createdAt) as string,
    updatedAt: campaign.updatedAt.toISOString(),
  };
}

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: ListCampaignsQueryDto) {
    const { page, limit, status, farmer } = query;
    const where = {
      ...(status ? { status } : {}),
      ...(farmer ? { farmer } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return {
      data: rows.map(toCampaignSummary),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async detail(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        tranches: { orderBy: { releasedAt: 'asc' } },
        disputes: { orderBy: { openedAt: 'desc' } },
      },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${id} not found`);
    }

    const investmentAgg = await this.prisma.investment.aggregate({
      where: { campaignId: id },
      _count: { _all: true },
      _sum: { amount: true },
    });

    return {
      ...toCampaignSummary(campaign),
      tranches: campaign.tranches.map((t) => ({
        id: t.id,
        recipient: t.recipient,
        amount: numeric(t.amount) as string,
        releasedAt: numeric(t.releasedAt) as string,
        txHash: t.txHash,
      })),
      disputes: campaign.disputes.map((d) => ({
        id: d.id,
        opener: d.opener,
        reason: d.reason,
        status: d.status,
        resolution: d.resolution,
        admin: d.admin,
        payoutToFarmer: numeric(d.payoutToFarmer),
        refundableToInvestors: numeric(d.refundableToInvestors),
        openedAt: numeric(d.openedAt) as string,
        resolvedAt: numeric(d.resolvedAt),
      })),
      latestDispute:
        campaign.disputes.length > 0
          ? {
              id: campaign.disputes[0].id,
              status: campaign.disputes[0].status,
              resolution: campaign.disputes[0].resolution,
            }
          : null,
      fundingSummary: {
        targetAmount: numeric(campaign.targetAmount),
        totalFunded: numeric(campaign.totalFunded) as string,
        refundable: numeric(campaign.refundable) as string,
        returnable: numeric(campaign.returnable) as string,
        investmentCount: investmentAgg._count._all,
        investedTotal: numeric(investmentAgg._sum.amount ?? 0n) as string,
      },
    };
  }

  /** Activity history: reuses Transaction rows, which already record every indexed on-chain event for the campaign. */
  async activity(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${id} not found`);
    }

    const rows = await this.prisma.transaction.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((t) => ({
      id: t.id,
      type: t.type,
      amount: numeric(t.amount),
      txHash: t.txHash,
      status: t.status,
      timestamp: numeric(t.timestamp),
      createdAt: t.createdAt.toISOString(),
    }));
  }
}
