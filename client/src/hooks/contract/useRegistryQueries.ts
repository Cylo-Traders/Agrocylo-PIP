import { useQuery } from '@tanstack/react-query';
import {
  contractMethod,
  getRegistryClient,
} from '../../lib/soroban/contractClient';
import { isRegistryConfigured } from '../../lib/soroban/config';
import { contractQueryKeys } from './queryKeys';
import type {
  ActivityRecord,
  CampaignInfo,
  FarmerProfile,
} from '../../lib/soroban/types';

/** Read hooks for RegistryContract state (farmer profiles, campaign activity log). */

export function useFarmer(address: string | undefined) {
  return useQuery({
    queryKey: contractQueryKeys.farmer(address ?? ''),
    enabled: Boolean(address) && isRegistryConfigured(),
    queryFn: async (): Promise<FarmerProfile | undefined> => {
      const client = await getRegistryClient();
      const tx = await contractMethod<FarmerProfile | undefined>(
        client,
        'get_farmer',
      )({ farmer: address! });
      return tx.result;
    },
  });
}

export interface FarmerCampaignSummary extends CampaignInfo {
  id: bigint;
}

/**
 * A farmer's registered campaigns, joined from `get_campaigns_by_farmer` (ids)
 * + `get_campaign` (title/description/created_at) per id. Independent of
 * whether the farmer has a `FarmerProfile` -- campaign/farmer linkage is
 * tracked separately from profile registration, so this can be non-empty
 * even for an address that hasn't registered a profile yet.
 */
export function useFarmerCampaigns(address: string | undefined) {
  return useQuery({
    queryKey: contractQueryKeys.farmerCampaigns(address ?? ''),
    enabled: Boolean(address) && isRegistryConfigured(),
    queryFn: async (): Promise<FarmerCampaignSummary[]> => {
      const client = await getRegistryClient();
      const idsTx = await contractMethod<bigint[]>(
        client,
        'get_campaigns_by_farmer',
      )({ farmer: address! });

      const campaigns = await Promise.all(
        idsTx.result.map(async (id) => {
          const tx = await contractMethod<CampaignInfo | undefined>(
            client,
            'get_campaign',
          )({ campaign_id: id });
          return tx.result ? { ...tx.result, id } : null;
        }),
      );

      return campaigns.filter((c): c is FarmerCampaignSummary => c !== null);
    },
  });
}

export function useActivity(campaignId: string | undefined) {
  return useQuery({
    queryKey: contractQueryKeys.activity(campaignId ?? ''),
    enabled: Boolean(campaignId) && isRegistryConfigured(),
    queryFn: async (): Promise<ActivityRecord[]> => {
      const client = await getRegistryClient();
      const tx = await contractMethod<ActivityRecord[]>(
        client,
        'get_campaign_activities',
      )({ campaign_id: BigInt(campaignId!) });
      return tx.result;
    },
  });
}
