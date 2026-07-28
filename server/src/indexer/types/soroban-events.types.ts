/**
 * `topic` and `value` are the already-decoded (via `scValToNative`) native JS
 * representation of the Soroban RPC event's `topic: xdr.ScVal[]` and
 * `value: xdr.ScVal`. Conversion from raw XDR happens once, at the RPC
 * boundary in SorobanEventListenerService, so everything downstream works
 * with plain strings/numbers/bigints/arrays.
 */
export interface RawSorobanEvent {
  id: string;
  type: string;
  contractId?: string;
  topic: unknown[];
  value: unknown;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
}

export interface ParsedEvent {
  /** Unique event ID from Soroban */
  id: string;
  /** High-level event type name (campaign.created, campaign.invested, etc.) */
  type: string;
  /** Contract event name (CampaignCreated, ContribReceived, etc.) */
  contractEvent: string;
  contractId: string;
  ledger: number;
  txHash: string;
  /** Parsed, human-friendly payload */
  data: Record<string, unknown>;
  raw: Record<string, unknown>;
  /** Campaign row this event applies to, if any. Used for generic audit persistence. */
  campaignId?: string;
  /** User row this event applies to, if any and already upserted by the handler. */
  userAddress?: string;
  /** Primary token amount moved by this event, if any. */
  amount?: bigint;
}

// ---------------------------------------------------------------------------
// ProductionEscrowContract events (contracts/production_escrow/src/events.rs)
// ---------------------------------------------------------------------------

export interface CampaignEscrowCreatedData {
  campaignId: string;
  farmer: string;
  timestamp: number;
  targetAmount: string;
}

export interface CampaignInvestedData {
  campaignId: string;
  investor: string;
  amount: string;
  timestamp: number;
}

export interface CampaignFundedData {
  campaignId: string;
  timestamp: number;
  totalFunded: string;
}

export interface TranchesConfiguredData {
  campaignId: string;
  timestamp: number;
  trancheCount: number;
}

export interface TrancheReleasedData {
  campaignId: string;
  recipient: string;
  amount: string;
  timestamp: number;
}

export interface HarvestReportedData {
  campaignId: string;
  farmer: string;
  outcome: string;
  timestamp: number;
}

export interface CampaignFailedData {
  campaignId: string;
  timestamp: number;
  refundable: string;
}

export interface ReturnClaimedData {
  campaignId: string;
  investor: string;
  amount: string;
  timestamp: number;
}

export interface RefundClaimedData {
  campaignId: string;
  investor: string;
  amount: string;
  timestamp: number;
}

export interface DisputeOpenedData {
  campaignId: string;
  opener: string;
  reason: string;
  timestamp: number;
  ledgerSequence: number;
}

export interface DisputeResolvedData {
  campaignId: string;
  admin: string;
  resolution: string;
  payoutToFarmer: string;
  refundableToInvestors: string;
  timestamp: number;
  ledgerSequence: number;
}

export interface CampaignSettledData {
  campaignId: string;
  farmer: string;
  timestamp: number;
  farmerPayout: string;
  investorReturns: string;
}

// ---------------------------------------------------------------------------
// RegistryContract events (contracts/registry/src/events.rs)
// ---------------------------------------------------------------------------

export interface AdminInitializedData {
  admin: string;
  timestamp: number;
  ledgerSequence: number;
}

export interface AdminUpdatedData {
  actor: string;
  oldAdmin: string;
  newAdmin: string;
  timestamp: number;
  ledgerSequence: number;
}

export interface ContractApprovedData {
  actor: string;
  contract: string;
  timestamp: number;
  ledgerSequence: number;
}

export interface ContractRevokedData {
  actor: string;
  contract: string;
  timestamp: number;
  ledgerSequence: number;
}

export interface FarmerRegisteredData {
  farmer: string;
  name?: string;
  timestamp: number;
  ledgerSequence: number;
}

export interface CampaignCreatedData {
  campaignId: string;
  farmer: string;
  title?: string;
  timestamp: number;
  ledgerSequence: number;
}

export interface CampaignEscrowLinkedData {
  campaignId: string;
  farmer: string;
  escrowContract: string;
  timestamp: number;
  ledgerSequence: number;
}

export interface CampaignStatusUpdatedData {
  campaignId: string;
  prevStatus?: string;
  newStatus?: string;
  timestamp: number;
  ledgerSequence: number;
}

export interface ActivityRecordedData {
  campaignId: string;
  actor: string;
  actionType: string;
  timestamp: number;
  ledgerSequence: number;
}

export type ParsedEventData =
  | CampaignEscrowCreatedData
  | CampaignInvestedData
  | CampaignFundedData
  | TranchesConfiguredData
  | TrancheReleasedData
  | HarvestReportedData
  | CampaignFailedData
  | ReturnClaimedData
  | RefundClaimedData
  | DisputeOpenedData
  | DisputeResolvedData
  | CampaignSettledData
  | AdminInitializedData
  | AdminUpdatedData
  | ContractApprovedData
  | ContractRevokedData
  | FarmerRegisteredData
  | CampaignCreatedData
  | CampaignEscrowLinkedData
  | CampaignStatusUpdatedData
  | ActivityRecordedData;
