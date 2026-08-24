import { useQuery } from '@tanstack/react-query';
import { loadRecentEscrowEvents } from '../lib/soroban/events';
import { contractMethod, getEscrowClient } from '../lib/soroban/contractClient';
import { getCampaign as getRegistryCampaign } from '../lib/contracts/registry';
import {
  ESCROW_CONTRACT_ID,
  RPC_URL,
  isEscrowConfigured,
  isRegistryConfigured,
} from '../lib/soroban/config';
import { contractQueryKeys } from './contract/queryKeys';
import {
  aggregateInvestorEvents,
  toFundedInvestment,
  type FundedInvestment,
} from '../lib/soroban/investorService';
import type { Campaign } from '../lib/soroban/types';

const DEFAULT_LOOKBACK_LEDGERS = 120_000;

const LOOKBACK_LEDGERS = (() => {
  const parsed = Number(import.meta.env.VITE_SOROBAN_EVENTS_LOOKBACK_LEDGERS);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_LOOKBACK_LEDGERS;
})();

/**
 * Discovers campaigns the connected wallet funded from ProductionEscrowContract
 * event history (there is no on-chain "list investments for address" getter)
 * and hydrates each row from `get_campaign` / `get_contribution`.
 */
export function useInvestorPortfolio(walletAddress: string | null | undefined) {
  return useQuery({
    queryKey: contractQueryKeys.investorPortfolio(walletAddress ?? ''),
    enabled: Boolean(walletAddress) && isEscrowConfigured(),
    queryFn: async (): Promise<FundedInvestment[]> => {
      const events = await loadRecentEscrowEvents({
        rpcUrl: RPC_URL!,
        contractId: ESCROW_CONTRACT_ID!,
        lookbackLedgers: LOOKBACK_LEDGERS,
      });

      const byCampaign = aggregateInvestorEvents(events, walletAddress!);
      const client = await getEscrowClient();

      const rows = await Promise.all(
        Array.from(byCampaign.entries()).map(
          async ([id, amounts]): Promise<FundedInvestment | null> => {
            try {
              const campaignTx = await contractMethod<Campaign>(
                client,
                'get_campaign',
              )({ campaign_id: BigInt(id) });
              const contributionTx = await contractMethod<bigint>(
                client,
                'get_contribution',
              )({
                campaign_id: BigInt(id),
                investor: walletAddress!,
              });

              let title: string | undefined;
              if (isRegistryConfigured()) {
                try {
                  const info = await getRegistryCampaign(BigInt(id));
                  title = info?.title;
                } catch {
                  // Registry lookup is best-effort; harvest metadata is the fallback.
                }
              }

              return toFundedInvestment({
                campaignId: id,
                campaign: campaignTx.result,
                currentContribution: contributionTx.result,
                amounts,
                walletAddress: walletAddress!,
                title,
              });
            } catch {
              return null;
            }
          },
        ),
      );

      return rows
        .filter((row): row is FundedInvestment => row !== null)
        .sort((a, b) => Number(b.campaignId) - Number(a.campaignId));
    },
  });
}
