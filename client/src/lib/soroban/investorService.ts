import type { EscrowEvent } from './events';
import type { Campaign, CampaignStatusTag } from './types';

export type CampaignStatus = CampaignStatusTag;

export interface FundedInvestment {
  campaignId: string;
  title: string;
  amountContributed: number;
  status: CampaignStatus;
  claimableAmount: number;
  claimed: boolean;
  walletAddress: string;
  fundedAt: string;
}

export interface PortfolioStats {
  totalInvested: number;
  totalClaimed: number;
  totalPending: number;
}

export interface InvestorCampaignAmounts {
  contributed: bigint;
  claimedRefund: bigint;
  claimedReturn: bigint;
  firstFundedAt: string | null;
}

export interface InvestorPortfolioSnapshot {
  campaignId: string;
  campaign: Campaign;
  currentContribution: bigint;
  amounts: InvestorCampaignAmounts;
  walletAddress: string;
  title?: string;
}

function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
}

function toAddress(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '');
}

function addressesMatch(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function unixToIso(value: unknown): string | null {
  const seconds =
    typeof value === 'bigint' ? Number(value) : Number(value ?? Number.NaN);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

/** Integer pro-rata share matching ProductionEscrowContract claim math. */
export function proRataShare(
  contributed: bigint,
  pool: bigint,
  totalFunded: bigint,
): bigint {
  if (contributed <= 0n || pool <= 0n || totalFunded <= 0n) return 0n;
  return (contributed * pool) / totalFunded;
}

export function claimableForStatus(
  status: CampaignStatusTag,
  contributed: bigint,
  campaign: Campaign,
): bigint {
  if (status === 'Resolved' || status === 'Failed') {
    return proRataShare(
      contributed,
      campaign.refundable,
      campaign.total_funded,
    );
  }
  if (status === 'Settled') {
    return proRataShare(
      contributed,
      campaign.returnable,
      campaign.total_funded,
    );
  }
  return 0n;
}

/**
 * Groups escrow events for a single investor into per-campaign contribution
 * and claim totals. Used by the dashboard so portfolio rows come from
 * ContribReceived / RefundClaimed / ReturnClaimed logs, not MOCK_INVESTMENTS.
 */
export function aggregateInvestorEvents(
  events: EscrowEvent[],
  walletAddress: string,
): Map<string, InvestorCampaignAmounts> {
  const byCampaign = new Map<string, InvestorCampaignAmounts>();

  const ensure = (campaignId: string): InvestorCampaignAmounts => {
    const existing = byCampaign.get(campaignId);
    if (existing) return existing;
    const created: InvestorCampaignAmounts = {
      contributed: 0n,
      claimedRefund: 0n,
      claimedReturn: 0n,
      firstFundedAt: null,
    };
    byCampaign.set(campaignId, created);
    return created;
  };

  for (const event of events) {
    if (!event.campaignId) continue;
    const investor = toAddress(event.values[0]);
    if (!investor || !addressesMatch(investor, walletAddress)) continue;

    if (event.name === 'ContribReceived') {
      const amounts = ensure(event.campaignId);
      amounts.contributed += toBigInt(event.values[2]);
      if (!amounts.firstFundedAt) {
        amounts.firstFundedAt = unixToIso(event.values[1]);
      }
    } else if (event.name === 'RefundClaimed') {
      ensure(event.campaignId).claimedRefund += toBigInt(event.values[2]);
    } else if (event.name === 'ReturnClaimed') {
      ensure(event.campaignId).claimedReturn += toBigInt(event.values[2]);
    }
  }

  return byCampaign;
}

export function toFundedInvestment(
  snapshot: InvestorPortfolioSnapshot,
): FundedInvestment {
  const status = snapshot.campaign.status.tag;
  const remaining = snapshot.currentContribution;
  const originalContributed =
    remaining > 0n ? remaining : snapshot.amounts.contributed;
  const claimedPayout =
    snapshot.amounts.claimedRefund + snapshot.amounts.claimedReturn;
  const claimed = remaining <= 0n && claimedPayout > 0n;
  const claimable = claimed
    ? claimedPayout
    : claimableForStatus(status, remaining, snapshot.campaign);

  return {
    campaignId: snapshot.campaignId,
    title:
      snapshot.title?.trim() ||
      snapshot.campaign.harvest_metadata ||
      `Campaign #${snapshot.campaignId}`,
    amountContributed: Number(originalContributed),
    status,
    claimableAmount: Number(claimable),
    claimed,
    walletAddress: snapshot.walletAddress,
    fundedAt: snapshot.amounts.firstFundedAt ?? '',
  };
}

export function calculatePortfolioStats(
  investments: FundedInvestment[],
): PortfolioStats {
  return investments.reduce(
    (acc, inv) => {
      acc.totalInvested += inv.amountContributed;
      if (inv.claimed) {
        acc.totalClaimed += inv.claimableAmount;
      } else {
        acc.totalPending += inv.claimableAmount;
      }
      return acc;
    },
    { totalInvested: 0, totalClaimed: 0, totalPending: 0 },
  );
}

/**
 * Fixture data used only by `src/__tests__/investorService.test.ts` (excluded
 * from the vitest suite). The live dashboard reads on-chain events via
 * `useInvestorPortfolio` — do not import these mocks from pages/components.
 */
const MOCK_INVESTMENTS: FundedInvestment[] = [
  {
    campaignId: 'camp-101',
    title: 'Organic Maize Irrigation & Harvesting PIP',
    amountContributed: 2500,
    status: 'Funding',
    claimableAmount: 0,
    claimed: false,
    walletAddress: 'GDF4...M9XZ',
    fundedAt: '2026-07-15T10:00:00Z',
  },
  {
    campaignId: 'camp-102',
    title: 'Solar-Powered Cold Chain Logistics PIP',
    amountContributed: 5000,
    status: 'Settled',
    claimableAmount: 6250,
    claimed: false,
    walletAddress: 'GDF4...M9XZ',
    fundedAt: '2026-06-01T14:30:00Z',
  },
  {
    campaignId: 'camp-103',
    title: 'Bio-Organic Fertilizer Expansion PIP',
    amountContributed: 1500,
    status: 'Failed',
    claimableAmount: 1500,
    claimed: false,
    walletAddress: 'GDF4...M9XZ',
    fundedAt: '2026-05-20T09:15:00Z',
  },
];

/** @deprecated Test/storybook fixture. The dashboard does not call this. */
export function getInvestorPortfolio(
  walletAddress: string,
): FundedInvestment[] {
  if (!walletAddress) return [];
  // Strict wallet filtering
  return MOCK_INVESTMENTS.filter(
    (inv) => inv.walletAddress.toLowerCase() === walletAddress.toLowerCase(),
  );
}

/** @deprecated Test fixture. Claims go through `useClaimRefund`. */
export async function claimRefund(
  campaignId: string,
  walletAddress: string,
): Promise<{
  success: boolean;
  txHash?: string;
  claimedAmount?: number;
  error?: string;
}> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const item = MOCK_INVESTMENTS.find(
    (inv) =>
      inv.campaignId === campaignId &&
      inv.walletAddress.toLowerCase() === walletAddress.toLowerCase(),
  );

  if (!item) {
    return { success: false, error: 'Investment record not found' };
  }

  if (item.status !== 'Resolved' && item.status !== 'Failed') {
    return {
      success: false,
      error: `Cannot claim refund for campaign in '${item.status}' status`,
    };
  }

  if (item.claimed) {
    return { success: false, error: 'Refund has already been claimed' };
  }

  item.claimed = true;
  const txHash = `0x${Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('')}`;

  return {
    success: true,
    txHash,
    claimedAmount: item.claimableAmount,
  };
}

/** @deprecated Test fixture. Claims go through `useClaimReturn`. */
export async function claimReturn(
  campaignId: string,
  walletAddress: string,
): Promise<{
  success: boolean;
  txHash?: string;
  claimedAmount?: number;
  error?: string;
}> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const item = MOCK_INVESTMENTS.find(
    (inv) =>
      inv.campaignId === campaignId &&
      inv.walletAddress.toLowerCase() === walletAddress.toLowerCase(),
  );

  if (!item) {
    return { success: false, error: 'Investment record not found' };
  }

  if (item.status !== 'Settled') {
    return {
      success: false,
      error: `Cannot claim return for campaign in '${item.status}' status`,
    };
  }

  if (item.claimed) {
    return { success: false, error: 'Return payout has already been claimed' };
  }

  item.claimed = true;
  const txHash = `0x${Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('')}`;

  return {
    success: true,
    txHash,
    claimedAmount: item.claimableAmount,
  };
}
