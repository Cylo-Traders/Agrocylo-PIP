import { useQuery } from '@tanstack/react-query';
import {
  contractMethod,
  getEscrowClient,
} from '../../lib/soroban/contractClient';
import { isEscrowConfigured } from '../../lib/soroban/config';
import { contractQueryKeys } from './queryKeys';
import type {
  Campaign,
  Dispute,
  HarvestRecord,
  Tranche,
} from '../../lib/soroban/types';

/**
 * Read hooks for ProductionEscrowContract state. Every hook returns the
 * standard `useQuery` result (`data`, `isLoading`, `isError`, `error`, ...),
 * so loading/error handling is uniform across all of them.
 */

export function useCampaign(campaignId: string | undefined) {
  return useQuery({
    queryKey: contractQueryKeys.campaign(campaignId ?? ''),
    enabled: Boolean(campaignId) && isEscrowConfigured(),
    queryFn: async (): Promise<Campaign> => {
      const client = await getEscrowClient();
      const tx = await contractMethod<Campaign>(
        client,
        'get_campaign',
      )({
        campaign_id: BigInt(campaignId!),
      });
      return tx.result;
    },
  });
}

export function useDispute(
  campaignId: string | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: contractQueryKeys.dispute(campaignId ?? ''),
    enabled:
      Boolean(campaignId) && isEscrowConfigured() && (options.enabled ?? true),
    queryFn: async (): Promise<Dispute> => {
      const client = await getEscrowClient();
      const tx = await contractMethod<Dispute>(
        client,
        'get_dispute',
      )({
        campaign_id: BigInt(campaignId!),
      });
      return tx.result;
    },
  });
}

export function useContribution(
  campaignId: string | undefined,
  address: string | undefined,
) {
  return useQuery({
    queryKey: contractQueryKeys.contribution(campaignId ?? '', address ?? ''),
    enabled: Boolean(campaignId) && Boolean(address) && isEscrowConfigured(),
    queryFn: async (): Promise<bigint> => {
      const client = await getEscrowClient();
      const tx = await contractMethod<bigint>(
        client,
        'get_contribution',
      )({
        campaign_id: BigInt(campaignId!),
        investor: address!,
      });
      return tx.result;
    },
  });
}

export function useTranches(campaignId: string | undefined) {
  return useQuery({
    queryKey: contractQueryKeys.tranches(campaignId ?? ''),
    enabled: Boolean(campaignId) && isEscrowConfigured(),
    queryFn: async (): Promise<Tranche[]> => {
      const client = await getEscrowClient();
      const tx = await contractMethod<Tranche[]>(
        client,
        'get_tranches',
      )({
        campaign_id: BigInt(campaignId!),
      });
      return tx.result;
    },
  });
}

export function useEscrowAdmin() {
  return useQuery({
    queryKey: contractQueryKeys.escrowAdmin(),
    enabled: isEscrowConfigured(),
    queryFn: async (): Promise<string> => {
      const client = await getEscrowClient();
      const tx = await contractMethod<string>(client, 'get_admin')({});
      return tx.result;
    },
  });
}

export function useHarvestRecord(
  campaignId: string | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: contractQueryKeys.harvestRecord(campaignId ?? ''),
    enabled:
      Boolean(campaignId) && isEscrowConfigured() && (options.enabled ?? true),
    queryFn: async (): Promise<HarvestRecord> => {
      const client = await getEscrowClient();
      const tx = await contractMethod<HarvestRecord>(
        client,
        'get_harvest_record',
      )({ campaign_id: BigInt(campaignId!) });
      return tx.result;
    },
  });
}
