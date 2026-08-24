import { describe, it, expect } from 'vitest';
import type { EscrowEvent } from '../events';
import type { Campaign } from '../types';
import {
  aggregateInvestorEvents,
  calculatePortfolioStats,
  claimableForStatus,
  proRataShare,
  toFundedInvestment,
} from '../investorService';

const WALLET = 'GABCDEFINVESTOR';
const OTHER = 'GOTHERWALLET';

function event(
  name: string,
  campaignId: string,
  values: unknown[],
): EscrowEvent {
  return {
    id: `${name}-${campaignId}`,
    ledger: 1,
    ledgerClosedAt: '2026-01-01T00:00:00Z',
    campaignId,
    name,
    values,
  };
}

function campaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    farmer: 'GFARMER',
    target_amount: 1000n,
    token_address: 'CTOKEN',
    deadline: 0n,
    harvest_metadata: 'maize',
    total_funded: 1000n,
    released: 0n,
    refundable: 0n,
    returnable: 0n,
    status: { tag: 'Funding' },
    ...overrides,
  };
}

describe('investor portfolio mapping', () => {
  it('keeps only ContribReceived / claim events for the connected wallet', () => {
    const byCampaign = aggregateInvestorEvents(
      [
        event('ContribReceived', '1', [WALLET, 1_700_000_000, 600n]),
        event('ContribReceived', '1', [OTHER, 1_700_000_100, 400n]),
        event('ContribReceived', '2', [WALLET, 1_700_000_200, 250n]),
        event('RefundClaimed', '2', [WALLET, 1_700_000_300, 250n]),
        event('CampaignCreated', '1', [WALLET, 1_700_000_000, 1000n]),
      ],
      WALLET,
    );

    expect(byCampaign.size).toBe(2);
    expect(byCampaign.get('1')?.contributed).toBe(600n);
    expect(byCampaign.get('2')?.contributed).toBe(250n);
    expect(byCampaign.get('2')?.claimedRefund).toBe(250n);
  });

  it('computes claimable refunds and returns with on-chain integer division', () => {
    expect(proRataShare(600n, 700n, 1000n)).toBe(420n);

    const failed = campaign({
      total_funded: 1000n,
      refundable: 1000n,
      status: { tag: 'Failed' },
    });
    expect(claimableForStatus('Failed', 400n, failed)).toBe(400n);

    const settled = campaign({
      total_funded: 1000n,
      returnable: 500n,
      status: { tag: 'Settled' },
    });
    expect(claimableForStatus('Settled', 400n, settled)).toBe(200n);
    expect(claimableForStatus('Funding', 400n, settled)).toBe(0n);
  });

  it('marks a row claimed from claim events rather than a fake tx hash', () => {
    const row = toFundedInvestment({
      campaignId: '9',
      campaign: campaign({
        status: { tag: 'Failed' },
        refundable: 1500n,
        total_funded: 1500n,
      }),
      currentContribution: 0n,
      amounts: {
        contributed: 1500n,
        claimedRefund: 1500n,
        claimedReturn: 0n,
        firstFundedAt: '2026-05-20T09:15:00.000Z',
      },
      walletAddress: WALLET,
      title: 'Failed Fertilizer PIP',
    });

    expect(row.claimed).toBe(true);
    expect(row.claimableAmount).toBe(1500);
    expect(row.amountContributed).toBe(1500);
    expect(row.title).toBe('Failed Fertilizer PIP');
    expect(JSON.stringify(row)).not.toMatch(/0x[0-9a-f]+/i);
  });

  it('calculates stats from the mapped portfolio, not MOCK_INVESTMENTS', () => {
    const stats = calculatePortfolioStats([
      {
        campaignId: '1',
        title: 'A',
        amountContributed: 600,
        status: 'Funding',
        claimableAmount: 0,
        claimed: false,
        walletAddress: WALLET,
        fundedAt: '',
      },
      {
        campaignId: '2',
        title: 'B',
        amountContributed: 400,
        status: 'Failed',
        claimableAmount: 400,
        claimed: true,
        walletAddress: WALLET,
        fundedAt: '',
      },
    ]);

    expect(stats).toEqual({
      totalInvested: 1000,
      totalClaimed: 400,
      totalPending: 0,
    });
  });
});
