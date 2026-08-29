import { Injectable } from '@nestjs/common';
import { PrismaClient } from '../../../generated/prisma/client';

function numeric(value: bigint | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toString();
}

/**
 * Which pooled escrow balance (if any) a campaign status makes claimable by
 * investors, and which `Campaign` column holds that pool -- mirrors
 * ProductionEscrowContract's own claim entrypoints:
 *   - `claim_refund` reads `campaign.refundable` (Resolved via dispute, or Failed).
 *   - `claim_return` reads `campaign.returnable` (Settled).
 */
const CLAIMABLE_POOL_BY_STATUS: Record<string, 'refundable' | 'returnable'> = {
  Resolved: 'refundable',
  Failed: 'refundable',
  Settled: 'returnable',
};

@Injectable()
export class InvestorsService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * An address's investments plus an estimated claimable amount per position.
   * Pro-rata share mirrors ProductionEscrowContract's own `claim_refund` /
   * `claim_return` formula: `contributed * pool / campaign.totalFunded`, where
   * `pool` is `campaign.refundable` (Resolved/Failed) or `campaign.returnable`
   * (Settled) depending on status.
   */
  async portfolio(address: string) {
    const investments = await this.prisma.investment.findMany({
      where: { investor: address },
      include: { campaign: true },
      orderBy: { createdAt: 'desc' },
    });

    const positions = investments.map((inv) => {
      const campaign = inv.campaign;
      let claimable = '0';
      const poolField = CLAIMABLE_POOL_BY_STATUS[campaign.status];
      if (poolField && campaign.totalFunded > 0n) {
        const pool = campaign[poolField];
        if (pool > 0n) {
          claimable = ((inv.amount * pool) / campaign.totalFunded).toString();
        }
      }

      return {
        investmentId: inv.id,
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        campaignStatus: campaign.status,
        amount: numeric(inv.amount) as string,
        txHash: inv.txHash,
        timestamp: numeric(inv.timestamp),
        claimable,
      };
    });

    const totalInvested = investments.reduce(
      (sum, inv) => sum + inv.amount,
      0n,
    );
    const totalClaimable = positions.reduce(
      (sum, p) => sum + BigInt(p.claimable),
      0n,
    );

    return {
      address,
      positions,
      summary: {
        totalInvested: totalInvested.toString(),
        totalClaimable: totalClaimable.toString(),
        positionCount: positions.length,
      },
    };
  }
}
