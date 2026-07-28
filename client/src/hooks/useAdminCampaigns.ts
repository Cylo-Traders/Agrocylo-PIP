import { useQuery } from '@tanstack/react-query';
import { loadRecentEscrowEvents } from '../lib/soroban/events';
import { contractMethod, getEscrowClient } from '../lib/soroban/contractClient';
import {
  ESCROW_CONTRACT_ID,
  RPC_URL,
  isEscrowConfigured,
} from '../lib/soroban/config';
import { contractQueryKeys } from './contract/queryKeys';
import type { Campaign, CampaignStatusTag } from '../lib/soroban/types';

const DEFAULT_LOOKBACK_LEDGERS = 120_000;

const LOOKBACK_LEDGERS = (() => {
  const parsed = Number(import.meta.env.VITE_SOROBAN_EVENTS_LOOKBACK_LEDGERS);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_LOOKBACK_LEDGERS;
})();

/** Statuses where at least one of the five admin actions is applicable. */
const ACTIONABLE_STATUSES: CampaignStatusTag[] = [
  'Active',
  'Funding',
  'Funded',
  'InProduction',
  'Harvested',
  'Disputed',
];

export interface AdminCampaignOverview {
  id: string;
  campaign: Campaign;
}

/**
 * Discovers campaigns from ProductionEscrowContract event history (there is
 * no on-chain "list all campaigns" getter) and fetches their current state,
 * filtered to campaigns where an admin action is still applicable. Mirrors
 * the event-scanning approach in hooks/useCampaignAnalytics.ts.
 */
export function useAdminCampaigns() {
  return useQuery({
    queryKey: contractQueryKeys.adminCampaignsOverview(),
    enabled: isEscrowConfigured(),
    queryFn: async (): Promise<AdminCampaignOverview[]> => {
      const events = await loadRecentEscrowEvents({
        rpcUrl: RPC_URL!,
        contractId: ESCROW_CONTRACT_ID!,
        lookbackLedgers: LOOKBACK_LEDGERS,
      });

      const campaignIds = Array.from(
        new Set(events.map((event) => event.campaignId).filter(Boolean)),
      );

      const client = await getEscrowClient();
      const overviews = await Promise.all(
        campaignIds.map(async (id): Promise<AdminCampaignOverview | null> => {
          try {
            const tx = await contractMethod<Campaign>(
              client,
              'get_campaign',
            )({ campaign_id: BigInt(id) });
            return { id, campaign: tx.result };
          } catch {
            // Campaign may no longer resolve (e.g. stale/malformed event) —
            // skip it rather than failing the whole dashboard load.
            return null;
          }
        }),
      );

      return overviews
        .filter((o): o is AdminCampaignOverview => o !== null)
        .filter((o) => ACTIONABLE_STATUSES.includes(o.campaign.status.tag))
        .sort((a, b) => Number(b.id) - Number(a.id));
    },
  });
}
