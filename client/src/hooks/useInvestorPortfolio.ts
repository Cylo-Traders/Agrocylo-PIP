import { useQuery } from '@tanstack/react-query';
import { loadRecentEscrowEvents } from '../lib/soroban/events';
import { contractMethod, getEscrowClient } from '../lib/soroban/contractClient';
import {
  ESCROW_CONTRACT_ID,
  RPC_URL,
  isEscrowConfigured,
} from '../lib/soroban/config';
import type { Campaign } from '../lib/soroban/types';
import type {
  FundedInvestment,
  CampaignStatus,
} from '../lib/soroban/investorService';

const DEFAULT_LOOKBACK_LEDGERS = 120_000;

const LOOKBACK_LEDGERS = (() => {
  const parsed = Number(import.meta.env.VITE_SOROBAN_EVENTS_LOOKBACK_LEDGERS);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_LOOKBACK_LEDGERS;
})();

export function useInvestorPortfolio(publicKey: string | undefined) {
  return useQuery({
    queryKey: ['investorPortfolio', publicKey ?? ''],
    enabled: Boolean(publicKey) && isEscrowConfigured(),
    queryFn: async (): Promise<FundedInvestment[]> => {
      if (!publicKey || !RPC_URL || !ESCROW_CONTRACT_ID) return [];

      const events = await loadRecentEscrowEvents({
        rpcUrl: RPC_URL,
        contractId: ESCROW_CONTRACT_ID,
        lookbackLedgers: LOOKBACK_LEDGERS,
      });

      // Filter events to ContribReceived or events where actor / investor is publicKey
      const userEvents = events.filter((e) => {
        const matchesName =
          e.name === 'ContribReceived' || e.name === 'fund_campaign';
        const matchesInvestor = e.values.some(
          (val) =>
            typeof val === 'string' &&
            val.toLowerCase() === publicKey.toLowerCase(),
        );
        return matchesName && matchesInvestor;
      });

      const campaignIds = Array.from(
        new Set(userEvents.map((e) => e.campaignId).filter(Boolean)),
      );

      const client = await getEscrowClient();
      const investments = await Promise.all(
        campaignIds.map(async (id): Promise<FundedInvestment | null> => {
          try {
            const campaignTx = await contractMethod<Campaign>(
              client,
              'get_campaign',
            )({ campaign_id: BigInt(id) });
            const campaign = campaignTx.result;

            const contribTx = await contractMethod<bigint>(
              client,
              'get_contribution',
            )({ campaign_id: BigInt(id), investor: publicKey });
            const contribAmount = contribTx.result;

            const amountContributed = Number(contribAmount);
            const statusTag = campaign.status.tag;

            let claimableAmount = 0;
            if (statusTag === 'Resolved' || statusTag === 'Failed') {
              claimableAmount = Number(campaign.refundable);
            } else if (statusTag === 'Settled') {
              claimableAmount = Number(campaign.returnable);
            }

            const status = statusTag as CampaignStatus;

            return {
              campaignId: id,
              title: campaign.harvest_metadata || `Campaign #${id}`,
              amountContributed,
              status,
              claimableAmount,
              claimed: contribAmount === 0n,
              walletAddress: publicKey,
              fundedAt: new Date().toISOString(),
            };
          } catch {
            return null;
          }
        }),
      );

      return investments.filter((inv): inv is FundedInvestment => inv !== null);
    },
  });
}
