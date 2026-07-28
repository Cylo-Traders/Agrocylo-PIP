import {
  contractMethod,
  getRegistryClient,
  invokeContractWrite,
} from '../soroban/contractClient';
import type { ContractWallet } from '../soroban/contractClient';
import type {
  ActivityActionTag,
  ActivityRecord,
  CampaignInfo,
  FarmerProfile,
} from '../soroban/types';

export type {
  ActivityActionTag,
  ActivityRecord,
  CampaignInfo,
  FarmerProfile,
} from '../soroban/types';

// ── Read wrappers ───────────────────────────────────────────────

export async function getFarmer(
  address: string,
): Promise<FarmerProfile | undefined> {
  const client = await getRegistryClient();
  const tx = await contractMethod<FarmerProfile | undefined>(
    client,
    'get_farmer',
  )({ farmer: address });
  return tx.result;
}

export async function getCampaign(
  campaignId: bigint,
): Promise<CampaignInfo | undefined> {
  const client = await getRegistryClient();
  const tx = await contractMethod<CampaignInfo | undefined>(
    client,
    'get_campaign',
  )({ campaign_id: campaignId });
  return tx.result;
}

export async function getCampaignActivities(
  campaignId: bigint,
): Promise<ActivityRecord[]> {
  const client = await getRegistryClient();
  const tx = await contractMethod<ActivityRecord[]>(
    client,
    'get_campaign_activities',
  )({ campaign_id: campaignId });
  return tx.result;
}

// ── Write wrappers ──────────────────────────────────────────────

export async function registerFarmer(
  farmer: string,
  name: string,
  location: string,
  wallet: ContractWallet,
): Promise<void> {
  await invokeContractWrite(
    getRegistryClient(),
    'register_farmer',
    { farmer, name, location },
    wallet,
  );
}

export async function registerCampaign(
  campaignId: bigint,
  farmer: string,
  title: string,
  description: string,
  wallet: ContractWallet,
): Promise<void> {
  await invokeContractWrite(
    getRegistryClient(),
    'register_campaign',
    { campaign_id: campaignId, farmer, title, description },
    wallet,
  );
}

export async function recordActivity(
  campaignId: bigint,
  actor: string,
  actionType: ActivityActionTag,
  wallet: ContractWallet,
): Promise<void> {
  await invokeContractWrite(
    getRegistryClient(),
    'record_activity',
    { campaign_id: campaignId, actor, action_type: { tag: actionType } },
    wallet,
  );
}
