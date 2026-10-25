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
import { isBackendApiEnabled } from '../lib/api/config';
import { getCampaigns } from '../lib/api/client';
import type { Campaign } from '../lib/soroban/types';

export const LOOKBACK_LEDGERS = (() => {
  const parsed = Number(import.meta.env.VITE_SOROBAN_EVENTS_LOOKBACK_LEDGERS);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_LOOKBACK_LEDGERS;
})();

export { DEFAULT_LOOKBACK_LEDGERS };

export interface CampaignOverview {
  id: string;
  campaign: Campaign;
}

export interface UseAllCampaignsOptions {
  lookbackLedgers?: number;
  useBackendFallback?: boolean;
}

/**
 * Discovers every campaign from ProductionEscrowContract event history (there
 * is no on-chain "list all campaigns" getter) and fetches its current state.
 *
 * Shares the event-scanning approach of hooks/useAdminCampaigns.ts but applies
 * no status filter — this backs the public `/campaigns` marketplace list, so
 * investors see campaigns in every lifecycle stage, newest id first.
 */
export function useAllCampaigns(options?: UseAllCampaignsOptions) {
  const lookback = options?.lookbackLedgers ?? LOOKBACK_LEDGERS;
  const useBackend = options?.useBackendFallback ?? isBackendApiEnabled();

  return useQuery({
    queryKey: [...contractQueryKeys.allCampaigns(), lookback, useBackend],
    enabled: isEscrowConfigured(),
    queryFn: async (): Promise<CampaignOverview[]> => {
      const events = await loadRecentEscrowEvents({
        rpcUrl: RPC_URL!,
        contractId: ESCROW_CONTRACT_ID!,
        lookbackLedgers: lookback,
      });

      const discoveredIds = new Set(
        events.map((event) => event.campaignId).filter(Boolean),
      );

      if (useBackend) {
        try {
          const backendCampaigns = await getCampaigns();
          for (const c of backendCampaigns) {
            if (c.id) discoveredIds.add(c.id);
          }
        } catch {
          // Backend discovery fallback is best effort
        }
      }

      const campaignIds = Array.from(discoveredIds);

      const client = await getEscrowClient();
      const overviews = await Promise.all(
        campaignIds.map(async (id): Promise<CampaignOverview | null> => {
          try {
            const tx = await contractMethod<Campaign>(
              client,
              'get_campaign',
            )({ campaign_id: BigInt(id) });
            return { id, campaign: tx.result };
          } catch {
            // Campaign may no longer resolve (e.g. stale/malformed event) —
            // skip it rather than failing the whole list load.
            return null;
          }
        }),
      );

      return overviews
        .filter((o): o is CampaignOverview => o !== null)
        .sort((a, b) => Number(b.id) - Number(a.id));
    },
  });
}
