import { useQuery } from '@tanstack/react-query';
import {
  loadRecentEscrowEvents,
  DEFAULT_LOOKBACK_LEDGERS,
} from '../lib/soroban/events';
import { contractMethod, getEscrowClient } from '../lib/soroban/contractClient';
import {
  ESCROW_CONTRACT_ID,
  RPC_URL,
  isEscrowConfigured,
} from '../lib/soroban/config';
import { contractQueryKeys } from './contract/queryKeys';
import { ACTIONABLE_STATUSES } from '../lib/campaignStatus';
import { isBackendApiEnabled } from '../lib/api/config';
import { getCampaigns } from '../lib/api/client';
import type { Campaign } from '../lib/soroban/types';

export const LOOKBACK_LEDGERS = (() => {
  const parsed = Number(import.meta.env.VITE_SOROBAN_EVENTS_LOOKBACK_LEDGERS);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_LOOKBACK_LEDGERS;
})();

export { DEFAULT_LOOKBACK_LEDGERS, ACTIONABLE_STATUSES };

export interface AdminCampaignOverview {
  id: string;
  campaign: Campaign;
}

export interface UseAdminCampaignsOptions {
  lookbackLedgers?: number;
  useBackendFallback?: boolean;
}

/**
 * Discovers campaigns from ProductionEscrowContract event history (there is
 * no on-chain "list all campaigns" getter) and fetches their current state,
 * filtered to campaigns where an admin action is still applicable.
 *
 * When backend API indexing is enabled (or requested via `useBackendFallback`),
 * it also queries the backend index to surface older campaigns outside the
 * event lookback window.
 */
export function useAdminCampaigns(options?: UseAdminCampaignsOptions) {
  const lookback = options?.lookbackLedgers ?? LOOKBACK_LEDGERS;
  const useBackend = options?.useBackendFallback ?? isBackendApiEnabled();

  return useQuery({
    queryKey: [
      ...contractQueryKeys.adminCampaignsOverview(),
      lookback,
      useBackend,
    ],
    enabled: isEscrowConfigured(),
    queryFn: async (): Promise<AdminCampaignOverview[]> => {
      const events = await loadRecentEscrowEvents({
        rpcUrl: RPC_URL!,
        contractId: ESCROW_CONTRACT_ID!,
        lookbackLedgers: lookback,
      });

      const discoveredIds = new Set(
        events.map((event) => event.campaignId).filter(Boolean),
      );

      // Tier 4 Strategy: When backend API is available, merge known campaign IDs
      // to surface campaigns older than the event lookback window.
      if (useBackend) {
        try {
          const backendCampaigns = await getCampaigns();
          for (const c of backendCampaigns) {
            if (c.id) discoveredIds.add(c.id);
          }
        } catch {
          // Backend discovery is best-effort fallback; don't fail event-based load.
        }
      }

      const campaignIds = Array.from(discoveredIds);

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
