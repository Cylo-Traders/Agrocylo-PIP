/**
 * Hand-written TypeScript shapes for the values decoded from the
 * ProductionEscrowContract and RegistryContract via `@stellar/stellar-sdk`'s
 * `contract.Client` (see contractClient.ts). These mirror
 * contracts/production_escrow/src/types.rs and contracts/registry/src/types.rs.
 *
 * Fieldless Rust enums (e.g. `CampaignStatus`) are decoded by the SDK as
 * `{ tag: "Variant" }` rather than a bare string, since soroban_sdk represents
 * them on the wire as unions.
 *
 * `CampaignStatusTag` is the on-chain union only — keep it in lockstep with
 * `contracts/production_escrow/src/types.rs` (`pub enum CampaignStatus`).
 * UI-only derived states (a Funded campaign that has already released a
 * tranche presenting as "in production") live in `lib/campaignStatus.ts` and
 * are not members of this union.
 */

/** On-chain `CampaignStatus` variants, in the order defined by the contract. */
export const ON_CHAIN_CAMPAIGN_STATUS_TAGS = [
  'Active',
  'Funding',
  'Funded',
  'InProduction',
  'Harvested',
  'Disputed',
  'Resolved',
  'Settled',
  'Failed',
] as const;

export type CampaignStatusTag = (typeof ON_CHAIN_CAMPAIGN_STATUS_TAGS)[number];

export type DisputeStatusTag = 'Open' | 'Resolved';

export type DisputeResolutionTag =
  'Pending' | 'FullRefund' | 'PartialSettlement' | 'FullPayout';

export type ActivityActionTag =
  | 'CampaignCreated'
  | 'CampaignFunded'
  | 'CampaignStatusChanged'
  | 'FundsReleased'
  | 'HarvestReported'
  | 'DisputeInitiated'
  | 'DisputeResolved'
  | 'CampaignSettled'
  | 'FarmerRegistered'
  | 'CampaignRegistered';

export interface EnumTag<T extends string> {
  tag: T;
  values?: unknown[];
}

export interface Campaign {
  farmer: string;
  target_amount: bigint;
  token_address: string;
  deadline: bigint;
  harvest_metadata: string;
  total_funded: bigint;
  released: bigint;
  refundable: bigint;
  returnable: bigint;
  status: EnumTag<CampaignStatusTag>;
}

export interface Dispute {
  campaign_id: bigint;
  opener: string;
  reason: string;
  timestamp: bigint;
  ledger_sequence: number;
  status: EnumTag<DisputeStatusTag>;
  resolution: EnumTag<DisputeResolutionTag>;
}

export interface Tranche {
  amount: bigint;
  milestone: string;
  released: boolean;
}

export interface HarvestRecord {
  farmer: string;
  outcome: string;
  timestamp: bigint;
  ledger_sequence: number;
}

export interface FarmerProfile {
  address: string;
  name: string;
  location: string;
  registration_time: bigint;
}

export interface CampaignInfo {
  id: bigint;
  farmer: string;
  title: string;
  description: string;
  created_at: bigint;
}

export interface ActivityRecord {
  actor: string;
  action_type: EnumTag<ActivityActionTag>;
  timestamp: bigint;
  ledger_sequence: number;
}
