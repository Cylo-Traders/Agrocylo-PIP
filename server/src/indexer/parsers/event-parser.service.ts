import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '../../../generated/prisma/client';
import type {
  RawSorobanEvent,
  ParsedEvent,
  CampaignEscrowCreatedData,
  CampaignInvestedData,
  CampaignFundedData,
  TranchesConfiguredData,
  TrancheReleasedData,
  HarvestReportedData,
  CampaignFailedData,
  ReturnClaimedData,
  RefundClaimedData,
  DisputeOpenedData,
  DisputeResolvedData,
  CampaignSettledData,
  AdminInitializedData,
  AdminUpdatedData,
  ContractApprovedData,
  ContractRevokedData,
  FarmerRegisteredData,
  CampaignCreatedData,
  CampaignEscrowLinkedData,
  CampaignStatusUpdatedData,
  ActivityRecordedData,
} from '../types/soroban-events.types';

function asString(v: unknown, field: string): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  throw new Error(`Expected string for '${field}', got ${typeof v}`);
}

function asBigInt(v: unknown, field: string): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number' && Number.isInteger(v)) return BigInt(v);
  if (typeof v === 'string' && /^-?\d+$/.test(v)) return BigInt(v);
  throw new Error(`Expected integer for '${field}', got ${typeof v}`);
}

function asNumber(v: unknown, field: string): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v);
  throw new Error(`Expected number for '${field}', got ${typeof v}`);
}

/**
 * Fieldless `#[contracttype]` enums (CampaignStatus, DisputeResolution, ...)
 * decode via `scValToNative` as a bare string, a single-element array
 * (`['Funding']`), or a `{ tag }` object depending on SDK version - normalize
 * all three shapes to the variant tag string.
 */
function decodeTag(v: unknown, field: string): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  if (
    v &&
    typeof v === 'object' &&
    typeof (v as { tag?: unknown }).tag === 'string'
  ) {
    return (v as { tag: string }).tag;
  }
  throw new Error(`Expected enum tag for '${field}', got ${JSON.stringify(v)}`);
}

function isTagLike(v: unknown): boolean {
  if (Array.isArray(v)) return typeof v[0] === 'string';
  if (v && typeof v === 'object')
    return typeof (v as { tag?: unknown }).tag === 'string';
  return false;
}

@Injectable()
export class EventParserService {
  private readonly logger = new Logger(EventParserService.name);

  constructor(private readonly prisma: PrismaClient) {}

  async processEvent(raw: RawSorobanEvent): Promise<void> {
    try {
      const parsed = this.parseEvent(raw);
      if (!parsed) return;
      await this.persistEvent(parsed);
    } catch (error) {
      this.logger.error(
        {
          eventId: raw.id,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to process event',
      );
    }
  }

  private parseEvent(raw: RawSorobanEvent): ParsedEvent | null {
    const topics = raw.topic ?? [];
    const eventName = asString(topics[0] ?? '', 'eventName');
    const arr = Array.isArray(raw.value) ? (raw.value as unknown[]) : [];

    switch (eventName) {
      // --- ProductionEscrowContract ---
      case 'CampaignCreated':
        return this.parseCampaignEscrowCreated(raw, topics, arr);
      case 'ContribReceived':
        return this.parseCampaignInvested(raw, topics, arr);
      case 'CampaignFunded':
        return this.parseCampaignFunded(raw, topics, arr);
      case 'TranchesConfigured':
        return this.parseTranchesConfigured(raw, topics, arr);
      case 'TrancheReleased':
        return this.parseTrancheReleased(raw, topics, arr);
      case 'HarvestReported':
        return this.parseHarvestReported(raw, topics, arr);
      case 'CampaignFailed':
        return this.parseCampaignFailed(raw, topics, arr);
      case 'ReturnClaimed':
        return this.parseReturnClaimed(raw, topics, arr);
      case 'RefundClaimed':
        return this.parseRefundClaimed(raw, topics, arr);
      case 'DisputeOpened':
        return this.parseDisputeOpened(raw, topics, arr);
      case 'DisputeResolved':
        return this.parseDisputeResolved(raw, topics, arr);
      case 'CampaignSettled':
        return this.parseCampaignSettled(raw, topics, arr);
      // --- RegistryContract ---
      case 'AdminInitialized':
        return this.parseAdminInitialized(raw, topics, arr);
      case 'AdminUpdated':
        return this.parseAdminUpdated(raw, topics, arr);
      case 'ContractApproved':
        return this.parseContractApproved(raw, topics, arr);
      case 'ContractRevoked':
        return this.parseContractRevoked(raw, topics, arr);
      case 'FarmerRegistered':
        return this.parseFarmerRegistered(raw, topics, arr);
      case 'CampaignRegistered':
        return this.parseCampaignRegistered(raw, topics, arr);
      case 'CampaignEscrowLinked':
        return this.parseCampaignEscrowLinked(raw, topics, arr);
      case 'CampaignStatusUpdated':
        return this.parseCampaignStatusUpdated(raw, topics, arr);
      case 'ActivityRecorded':
        return this.parseActivityRecorded(raw, topics, arr);
      default:
        // Not one of our contracts' events (e.g. a shared RPC filter picking
        // up something unrelated) - nothing to persist.
        return null;
    }
  }

  private buildEvent(
    raw: RawSorobanEvent,
    topics: unknown[],
    type: string,
    data: Record<string, unknown>,
    extra: { campaignId?: string; userAddress?: string; amount?: bigint } = {},
  ): ParsedEvent {
    return {
      id: raw.id,
      type,
      contractEvent: asString(topics[0] ?? '', 'eventName'),
      contractId: raw.contractId ?? '',
      ledger: raw.ledger,
      txHash: raw.txHash,
      data,
      raw: { topics, value: raw.value },
      ...extra,
    };
  }

  // ---------------------------------------------------------------------
  // ProductionEscrowContract parsers
  // (contracts/production_escrow/src/events.rs; topics[1] is always campaign_id)
  // ---------------------------------------------------------------------

  private parseCampaignEscrowCreated(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 3)
      throw new Error('CampaignCreated payload must have 3 elements');
    const campaignId = asString(topics[1], 'campaignId');
    const farmer = asString(arr[0], 'farmer');
    const timestamp = asNumber(arr[1], 'timestamp');
    const targetAmount = asBigInt(arr[2], 'targetAmount');
    const data: CampaignEscrowCreatedData = {
      campaignId,
      farmer,
      timestamp,
      targetAmount: targetAmount.toString(),
    };
    return this.buildEvent(
      raw,
      topics,
      'campaign.escrow_created',
      data as unknown as Record<string, unknown>,
      {
        campaignId,
        userAddress: farmer,
      },
    );
  }

  private parseCampaignInvested(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 3)
      throw new Error('ContribReceived payload must have 3 elements');
    const campaignId = asString(topics[1], 'campaignId');
    const investor = asString(arr[0], 'investor');
    const timestamp = asNumber(arr[1], 'timestamp');
    const amount = asBigInt(arr[2], 'amount');
    const data: CampaignInvestedData = {
      campaignId,
      investor,
      amount: amount.toString(),
      timestamp,
    };
    return this.buildEvent(
      raw,
      topics,
      'campaign.invested',
      data as unknown as Record<string, unknown>,
      {
        campaignId,
        userAddress: investor,
        amount,
      },
    );
  }

  private parseCampaignFunded(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 2)
      throw new Error('CampaignFunded payload must have 2 elements');
    const campaignId = asString(topics[1], 'campaignId');
    const timestamp = asNumber(arr[0], 'timestamp');
    const totalFunded = asBigInt(arr[1], 'totalFunded');
    const data: CampaignFundedData = {
      campaignId,
      timestamp,
      totalFunded: totalFunded.toString(),
    };
    return this.buildEvent(
      raw,
      topics,
      'campaign.funded',
      data as unknown as Record<string, unknown>,
      {
        campaignId,
        amount: totalFunded,
      },
    );
  }

  private parseTranchesConfigured(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 2)
      throw new Error('TranchesConfigured payload must have 2 elements');
    const campaignId = asString(topics[1], 'campaignId');
    const timestamp = asNumber(arr[0], 'timestamp');
    const trancheCount = asNumber(arr[1], 'trancheCount');
    const data: TranchesConfiguredData = {
      campaignId,
      timestamp,
      trancheCount,
    };
    return this.buildEvent(
      raw,
      topics,
      'campaign.tranches_configured',
      data as unknown as Record<string, unknown>,
      {
        campaignId,
      },
    );
  }

  private parseTrancheReleased(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 3)
      throw new Error('TrancheReleased payload must have 3 elements');
    const campaignId = asString(topics[1], 'campaignId');
    const recipient = asString(arr[0], 'recipient');
    const timestamp = asNumber(arr[1], 'timestamp');
    const amount = asBigInt(arr[2], 'amount');
    const data: TrancheReleasedData = {
      campaignId,
      recipient,
      amount: amount.toString(),
      timestamp,
    };
    return this.buildEvent(
      raw,
      topics,
      'campaign.tranche_released',
      data as unknown as Record<string, unknown>,
      {
        campaignId,
        userAddress: recipient,
        amount,
      },
    );
  }

  private parseHarvestReported(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 3)
      throw new Error('HarvestReported payload must have 3 elements');
    const campaignId = asString(topics[1], 'campaignId');
    const farmer = asString(arr[0], 'farmer');
    const outcome = asString(arr[1], 'outcome');
    const timestamp = asNumber(arr[2], 'timestamp');
    const data: HarvestReportedData = {
      campaignId,
      farmer,
      outcome,
      timestamp,
    };
    return this.buildEvent(
      raw,
      topics,
      'campaign.harvest_reported',
      data as unknown as Record<string, unknown>,
      {
        campaignId,
        userAddress: farmer,
      },
    );
  }

  private parseCampaignFailed(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 2)
      throw new Error('CampaignFailed payload must have 2 elements');
    const campaignId = asString(topics[1], 'campaignId');
    const timestamp = asNumber(arr[0], 'timestamp');
    const refundable = asBigInt(arr[1], 'refundable');
    const data: CampaignFailedData = {
      campaignId,
      timestamp,
      refundable: refundable.toString(),
    };
    return this.buildEvent(
      raw,
      topics,
      'campaign.failed',
      data as unknown as Record<string, unknown>,
      {
        campaignId,
        amount: refundable,
      },
    );
  }

  private parseReturnClaimed(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 3)
      throw new Error('ReturnClaimed payload must have 3 elements');
    const campaignId = asString(topics[1], 'campaignId');
    const investor = asString(arr[0], 'investor');
    const timestamp = asNumber(arr[1], 'timestamp');
    const amount = asBigInt(arr[2], 'amount');
    const data: ReturnClaimedData = {
      campaignId,
      investor,
      amount: amount.toString(),
      timestamp,
    };
    return this.buildEvent(
      raw,
      topics,
      'campaign.return_claimed',
      data as unknown as Record<string, unknown>,
      {
        campaignId,
        userAddress: investor,
        amount,
      },
    );
  }

  private parseRefundClaimed(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 3)
      throw new Error('RefundClaimed payload must have 3 elements');
    const campaignId = asString(topics[1], 'campaignId');
    const investor = asString(arr[0], 'investor');
    const timestamp = asNumber(arr[1], 'timestamp');
    const amount = asBigInt(arr[2], 'amount');
    const data: RefundClaimedData = {
      campaignId,
      investor,
      amount: amount.toString(),
      timestamp,
    };
    return this.buildEvent(
      raw,
      topics,
      'campaign.refund_claimed',
      data as unknown as Record<string, unknown>,
      {
        campaignId,
        userAddress: investor,
        amount,
      },
    );
  }

  private parseDisputeOpened(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 4)
      throw new Error('DisputeOpened payload must have 4 elements');
    const campaignId = asString(topics[1], 'campaignId');
    const opener = asString(arr[0], 'opener');
    const reason = asString(arr[1], 'reason');
    const timestamp = asNumber(arr[2], 'timestamp');
    const ledgerSequence = asNumber(arr[3], 'ledgerSequence');
    const data: DisputeOpenedData = {
      campaignId,
      opener,
      reason,
      timestamp,
      ledgerSequence,
    };
    return this.buildEvent(
      raw,
      topics,
      'campaign.dispute_opened',
      data as unknown as Record<string, unknown>,
      {
        campaignId,
        userAddress: opener,
      },
    );
  }

  private parseDisputeResolved(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 6)
      throw new Error('DisputeResolved payload must have 6 elements');
    const campaignId = asString(topics[1], 'campaignId');
    const admin = asString(arr[0], 'admin');
    const resolution = decodeTag(arr[1], 'resolution');
    const payoutToFarmer = asBigInt(arr[2], 'payoutToFarmer');
    const refundableToInvestors = asBigInt(arr[3], 'refundableToInvestors');
    const timestamp = asNumber(arr[4], 'timestamp');
    const ledgerSequence = asNumber(arr[5], 'ledgerSequence');
    const data: DisputeResolvedData = {
      campaignId,
      admin,
      resolution,
      payoutToFarmer: payoutToFarmer.toString(),
      refundableToInvestors: refundableToInvestors.toString(),
      timestamp,
      ledgerSequence,
    };
    return this.buildEvent(
      raw,
      topics,
      'campaign.dispute_resolved',
      data as unknown as Record<string, unknown>,
      {
        campaignId,
      },
    );
  }

  private parseCampaignSettled(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 4)
      throw new Error('CampaignSettled payload must have 4 elements');
    const campaignId = asString(topics[1], 'campaignId');
    const farmer = asString(arr[0], 'farmer');
    const timestamp = asNumber(arr[1], 'timestamp');
    const farmerPayout = asBigInt(arr[2], 'farmerPayout');
    const investorReturns = asBigInt(arr[3], 'investorReturns');
    const data: CampaignSettledData = {
      campaignId,
      farmer,
      timestamp,
      farmerPayout: farmerPayout.toString(),
      investorReturns: investorReturns.toString(),
    };
    return this.buildEvent(
      raw,
      topics,
      'campaign.settled',
      data as unknown as Record<string, unknown>,
      {
        campaignId,
        userAddress: farmer,
      },
    );
  }

  // ---------------------------------------------------------------------
  // RegistryContract parsers (contracts/registry/src/events.rs)
  //
  // FarmerRegistered/CampaignRegistered/CampaignStatusUpdated are emitted
  // from two call sites: a direct mutation (rich payload) and the generic
  // activity-log mirror in emit_activity_index_event (which always
  // publishes `(actor, action_type, timestamp, ledger_sequence)` under the
  // same topic). Both shapes are handled defensively below instead of
  // assuming the rich one.
  // ---------------------------------------------------------------------

  private parseAdminInitialized(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 3)
      throw new Error('AdminInitialized payload must have 3 elements');
    const admin = asString(arr[0], 'admin');
    const timestamp = asNumber(arr[1], 'timestamp');
    const ledgerSequence = asNumber(arr[2], 'ledgerSequence');
    const data: AdminInitializedData = { admin, timestamp, ledgerSequence };
    // Administrative bookkeeping event; there is no domain row for contract
    // admins, so this is intentionally audit-only (see the generic
    // Transaction row persisted in persistEvent).
    return this.buildEvent(
      raw,
      topics,
      'registry.admin_initialized',
      data as unknown as Record<string, unknown>,
    );
  }

  private parseAdminUpdated(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 5)
      throw new Error('AdminUpdated payload must have 5 elements');
    const actor = asString(arr[0], 'actor');
    const oldAdmin = asString(arr[1], 'oldAdmin');
    const newAdmin = asString(arr[2], 'newAdmin');
    const timestamp = asNumber(arr[3], 'timestamp');
    const ledgerSequence = asNumber(arr[4], 'ledgerSequence');
    const data: AdminUpdatedData = {
      actor,
      oldAdmin,
      newAdmin,
      timestamp,
      ledgerSequence,
    };
    return this.buildEvent(
      raw,
      topics,
      'registry.admin_updated',
      data as unknown as Record<string, unknown>,
    );
  }

  private parseContractApproved(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 4)
      throw new Error('ContractApproved payload must have 4 elements');
    const actor = asString(arr[0], 'actor');
    const contract = asString(arr[1], 'contract');
    const timestamp = asNumber(arr[2], 'timestamp');
    const ledgerSequence = asNumber(arr[3], 'ledgerSequence');
    const data: ContractApprovedData = {
      actor,
      contract,
      timestamp,
      ledgerSequence,
    };
    return this.buildEvent(
      raw,
      topics,
      'registry.contract_approved',
      data as unknown as Record<string, unknown>,
    );
  }

  private parseContractRevoked(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 4)
      throw new Error('ContractRevoked payload must have 4 elements');
    const actor = asString(arr[0], 'actor');
    const contract = asString(arr[1], 'contract');
    const timestamp = asNumber(arr[2], 'timestamp');
    const ledgerSequence = asNumber(arr[3], 'ledgerSequence');
    const data: ContractRevokedData = {
      actor,
      contract,
      timestamp,
      ledgerSequence,
    };
    return this.buildEvent(
      raw,
      topics,
      'registry.contract_revoked',
      data as unknown as Record<string, unknown>,
    );
  }

  private parseFarmerRegistered(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 3)
      throw new Error('FarmerRegistered payload must have at least 3 elements');
    // topics[1] is the farmer address in both emission shapes.
    const farmer = asString(topics[1], 'farmer');
    const timestamp = asNumber(arr[arr.length - 2], 'timestamp');
    const ledgerSequence = asNumber(arr[arr.length - 1], 'ledgerSequence');
    const nameCandidate = arr.length >= 4 ? arr[1] : undefined;
    const name = typeof nameCandidate === 'string' ? nameCandidate : undefined;
    const data: FarmerRegisteredData = {
      farmer,
      name,
      timestamp,
      ledgerSequence,
    };
    return this.buildEvent(
      raw,
      topics,
      'registry.farmer_registered',
      data as unknown as Record<string, unknown>,
      {
        userAddress: farmer,
      },
    );
  }

  private parseCampaignRegistered(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 4)
      throw new Error(
        'CampaignRegistered payload must have at least 4 elements',
      );
    const campaignId = asString(topics[1], 'campaignId');
    // value[0] is the farmer/actor address in both emission shapes.
    const farmer = asString(arr[0], 'farmer');
    const timestamp = asNumber(arr[arr.length - 2], 'timestamp');
    const ledgerSequence = asNumber(arr[arr.length - 1], 'ledgerSequence');
    // The direct campaign_registered() call publishes a plain-string title in
    // slot 1; the activity-log mirror publishes an ActivityAction enum tag
    // there instead. Only trust it as a title when it decoded to a string.
    const titleCandidate = arr[1];
    const title =
      typeof titleCandidate === 'string' ? titleCandidate : undefined;
    const data: CampaignCreatedData = {
      campaignId,
      farmer,
      title,
      timestamp,
      ledgerSequence,
    };
    return this.buildEvent(
      raw,
      topics,
      'campaign.created',
      data as unknown as Record<string, unknown>,
      {
        campaignId,
        userAddress: farmer,
      },
    );
  }

  private parseCampaignEscrowLinked(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 4)
      throw new Error('CampaignEscrowLinked payload must have 4 elements');
    const campaignId = asString(topics[1], 'campaignId');
    const farmer = asString(arr[0], 'farmer');
    const escrowContract = asString(arr[1], 'escrowContract');
    const timestamp = asNumber(arr[2], 'timestamp');
    const ledgerSequence = asNumber(arr[3], 'ledgerSequence');
    const data: CampaignEscrowLinkedData = {
      campaignId,
      farmer,
      escrowContract,
      timestamp,
      ledgerSequence,
    };
    return this.buildEvent(
      raw,
      topics,
      'campaign.escrow_linked',
      data as unknown as Record<string, unknown>,
      {
        campaignId,
        userAddress: farmer,
      },
    );
  }

  private parseCampaignStatusUpdated(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 4)
      throw new Error('CampaignStatusUpdated payload must have 4 elements');
    const campaignId = asString(topics[1], 'campaignId');
    const timestamp = asNumber(arr[2], 'timestamp');
    const ledgerSequence = asNumber(arr[3], 'ledgerSequence');
    let prevStatus: string | undefined;
    let newStatus: string | undefined;
    // The direct campaign_status_updated() call publishes two CampaignStatus
    // enum tags; the activity-log mirror publishes (actor: Address, ...)
    // instead, which decodes to a plain string rather than a tag shape.
    if (isTagLike(arr[0])) {
      prevStatus = decodeTag(arr[0], 'prevStatus');
      newStatus = decodeTag(arr[1], 'newStatus');
    }
    const data: CampaignStatusUpdatedData = {
      campaignId,
      prevStatus,
      newStatus,
      timestamp,
      ledgerSequence,
    };
    return this.buildEvent(
      raw,
      topics,
      'campaign.status_updated',
      data as unknown as Record<string, unknown>,
      {
        campaignId,
      },
    );
  }

  private parseActivityRecorded(
    raw: RawSorobanEvent,
    topics: unknown[],
    arr: unknown[],
  ): ParsedEvent {
    if (arr.length < 4)
      throw new Error('ActivityRecorded payload must have 4 elements');
    const campaignId = asString(topics[1], 'campaignId');
    const actor = asString(arr[0], 'actor');
    const actionType = decodeTag(arr[1], 'actionType');
    const timestamp = asNumber(arr[2], 'timestamp');
    const ledgerSequence = asNumber(arr[3], 'ledgerSequence');
    const data: ActivityRecordedData = {
      campaignId,
      actor,
      actionType,
      timestamp,
      ledgerSequence,
    };
    // Generic mirror of the specific events handled above; recording it as a
    // state mutation too would double-apply status/fund changes, so this is
    // intentionally audit-only.
    return this.buildEvent(
      raw,
      topics,
      'registry.activity_recorded',
      data as unknown as Record<string, unknown>,
      {
        campaignId,
      },
    );
  }

  // ---------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------

  private async persistEvent(parsed: ParsedEvent): Promise<void> {
    const existing = await this.prisma.transaction.findUnique({
      where: { id: parsed.id },
    });
    if (existing) return;

    switch (parsed.type) {
      case 'campaign.escrow_created':
        await this.handleCampaignEscrowCreated(parsed);
        break;
      case 'campaign.invested':
        await this.handleCampaignInvested(parsed);
        break;
      case 'campaign.funded':
        await this.handleCampaignFunded(parsed);
        break;
      case 'campaign.tranches_configured':
        await this.handleTranchesConfigured(parsed);
        break;
      case 'campaign.tranche_released':
        await this.handleTrancheReleased(parsed);
        break;
      case 'campaign.harvest_reported':
        await this.handleHarvestReported(parsed);
        break;
      case 'campaign.failed':
        await this.handleCampaignFailed(parsed);
        break;
      case 'campaign.return_claimed':
      case 'campaign.refund_claimed':
        await this.handleClaim(parsed);
        break;
      case 'campaign.dispute_opened':
        await this.handleDisputeOpened(parsed);
        break;
      case 'campaign.dispute_resolved':
        await this.handleDisputeResolved(parsed);
        break;
      case 'campaign.settled':
        await this.handleCampaignSettled(parsed);
        break;
      case 'campaign.created':
        await this.handleCampaignCreated(parsed);
        break;
      case 'campaign.escrow_linked':
        await this.handleCampaignEscrowLinked(parsed);
        break;
      case 'campaign.status_updated':
        await this.handleCampaignStatusUpdated(parsed);
        break;
      case 'registry.farmer_registered':
        await this.handleFarmerRegistered(parsed);
        break;
      case 'registry.admin_initialized':
      case 'registry.admin_updated':
      case 'registry.contract_approved':
      case 'registry.contract_revoked':
      case 'registry.activity_recorded':
        // Administrative/audit-only events: no domain row needs to change.
        // Still captured below via the generic Transaction audit row.
        break;
      default:
        this.logger.warn(
          { type: parsed.type },
          'No persistence handler for parsed event type',
        );
    }

    await this.prisma.transaction.create({
      data: {
        id: parsed.id,
        type: parsed.type,
        campaignId: parsed.campaignId,
        userId: parsed.userAddress,
        amount: parsed.amount,
        txHash: parsed.txHash,
        status: 'Confirmed',
        timestamp: BigInt(parsed.ledger),
        data: JSON.stringify(parsed, (_key, value) =>
          typeof value === 'bigint' ? value.toString() : value,
        ),
      },
    });
  }

  private async ensureUser(address: string, timestamp: number): Promise<void> {
    await this.prisma.user.upsert({
      where: { address },
      update: {},
      create: { address, firstSeenAt: BigInt(timestamp) },
    });
  }

  private async handleCampaignEscrowCreated(
    parsed: ParsedEvent,
  ): Promise<void> {
    const data = parsed.data as unknown as CampaignEscrowCreatedData;
    await this.ensureUser(data.farmer, data.timestamp);

    await this.prisma.campaign.upsert({
      where: { id: data.campaignId },
      update: { farmer: data.farmer, targetAmount: BigInt(data.targetAmount) },
      create: {
        id: data.campaignId,
        farmer: data.farmer,
        targetAmount: BigInt(data.targetAmount),
        createdAt: BigInt(data.timestamp),
      },
    });

    this.logger.log(
      { campaignId: data.campaignId },
      'Escrow-side campaign creation recorded',
    );
  }

  private async handleCampaignInvested(parsed: ParsedEvent): Promise<void> {
    const data = parsed.data as unknown as CampaignInvestedData;
    const campaignId = data.campaignId;

    await this.ensureUser(data.investor, data.timestamp);

    const amount = BigInt(data.amount);

    await this.prisma.investment.create({
      data: {
        id: parsed.id,
        campaignId,
        investor: data.investor,
        amount,
        txHash: parsed.txHash,
        timestamp: BigInt(data.timestamp),
      },
    });

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { totalFunded: { increment: amount } },
    });

    this.logger.log(
      { campaignId, investor: data.investor, amount: data.amount },
      'Investment recorded',
    );
  }

  private async handleCampaignFunded(parsed: ParsedEvent): Promise<void> {
    const data = parsed.data as unknown as CampaignFundedData;
    await this.prisma.campaign.update({
      where: { id: data.campaignId },
      data: { status: 'Funded', totalFunded: BigInt(data.totalFunded) },
    });
    this.logger.log({ campaignId: data.campaignId }, 'Campaign funded');
  }

  private async handleTranchesConfigured(parsed: ParsedEvent): Promise<void> {
    const data = parsed.data as unknown as TranchesConfiguredData;
    await this.prisma.campaign.update({
      where: { id: data.campaignId },
      data: { trancheCount: data.trancheCount },
    });
    this.logger.log(
      { campaignId: data.campaignId, trancheCount: data.trancheCount },
      'Tranches configured',
    );
  }

  private async handleTrancheReleased(parsed: ParsedEvent): Promise<void> {
    const data = parsed.data as unknown as TrancheReleasedData;
    await this.ensureUser(data.recipient, data.timestamp);
    await this.prisma.tranche.create({
      data: {
        id: parsed.id,
        campaignId: data.campaignId,
        recipient: data.recipient,
        amount: BigInt(data.amount),
        releasedAt: BigInt(data.timestamp),
        txHash: parsed.txHash,
      },
    });
    this.logger.log(
      { campaignId: data.campaignId, recipient: data.recipient },
      'Tranche released',
    );
  }

  private async handleHarvestReported(parsed: ParsedEvent): Promise<void> {
    const data = parsed.data as unknown as HarvestReportedData;
    await this.prisma.campaign.update({
      where: { id: data.campaignId },
      data: {
        status: 'Harvested',
        harvestOutcome: data.outcome,
        harvestReportedAt: BigInt(data.timestamp),
      },
    });
    this.logger.log(
      { campaignId: data.campaignId, outcome: data.outcome },
      'Harvest reported',
    );
  }

  private async handleCampaignFailed(parsed: ParsedEvent): Promise<void> {
    const data = parsed.data as unknown as CampaignFailedData;
    await this.prisma.campaign.update({
      where: { id: data.campaignId },
      data: { status: 'Failed', refundable: BigInt(data.refundable) },
    });
    this.logger.log({ campaignId: data.campaignId }, 'Campaign failed');
  }

  private async handleClaim(parsed: ParsedEvent): Promise<void> {
    // ReturnClaimed/RefundClaimed report a payout to an investor after
    // settlement/failure. A claim aggregates an investor's whole position
    // rather than a single contribution, so it isn't attributed to a
    // specific Investment row - it's persisted via the generic Transaction
    // audit row created in persistEvent. We still upsert the User row so
    // that audit row's userId FK is valid.
    const data = parsed.data as unknown as
      | ReturnClaimedData
      | RefundClaimedData;
    await this.ensureUser(data.investor, data.timestamp);
  }

  private async handleDisputeOpened(parsed: ParsedEvent): Promise<void> {
    const data = parsed.data as unknown as DisputeOpenedData;
    await this.ensureUser(data.opener, data.timestamp);
    await this.prisma.dispute.create({
      data: {
        id: parsed.id,
        campaignId: data.campaignId,
        opener: data.opener,
        reason: data.reason,
        status: 'Open',
        openedAt: BigInt(data.timestamp),
        ledgerSequence: data.ledgerSequence,
      },
    });
    await this.prisma.campaign.update({
      where: { id: data.campaignId },
      data: { status: 'Disputed' },
    });
    this.logger.log(
      { campaignId: data.campaignId, opener: data.opener },
      'Dispute opened',
    );
  }

  private async handleDisputeResolved(parsed: ParsedEvent): Promise<void> {
    const data = parsed.data as unknown as DisputeResolvedData;

    const openDispute = await this.prisma.dispute.findFirst({
      where: { campaignId: data.campaignId, status: 'Open' },
      orderBy: { openedAt: 'desc' },
    });

    if (openDispute) {
      await this.prisma.dispute.update({
        where: { id: openDispute.id },
        data: {
          status: 'Resolved',
          resolution: data.resolution,
          admin: data.admin,
          payoutToFarmer: BigInt(data.payoutToFarmer),
          refundableToInvestors: BigInt(data.refundableToInvestors),
          resolvedAt: BigInt(data.timestamp),
        },
      });
    } else {
      this.logger.warn(
        { campaignId: data.campaignId },
        'DisputeResolved received with no matching open dispute on record',
      );
    }

    await this.prisma.campaign.update({
      where: { id: data.campaignId },
      data: { status: 'Resolved' },
    });
    this.logger.log(
      { campaignId: data.campaignId, resolution: data.resolution },
      'Dispute resolved',
    );
  }

  private async handleCampaignSettled(parsed: ParsedEvent): Promise<void> {
    const data = parsed.data as unknown as CampaignSettledData;
    await this.prisma.campaign.update({
      where: { id: data.campaignId },
      data: { status: 'Settled' },
    });
    this.logger.log(
      { campaignId: data.campaignId, farmerPayout: data.farmerPayout },
      'Campaign settled',
    );
  }

  private async handleCampaignCreated(parsed: ParsedEvent): Promise<void> {
    const data = parsed.data as unknown as CampaignCreatedData;
    await this.ensureUser(data.farmer, data.timestamp);

    await this.prisma.campaign.upsert({
      where: { id: data.campaignId },
      update:
        data.title !== undefined
          ? { farmer: data.farmer, title: data.title }
          : { farmer: data.farmer },
      create: {
        id: data.campaignId,
        farmer: data.farmer,
        title: data.title ?? '',
        createdAt: BigInt(data.timestamp),
      },
    });

    this.logger.log(
      { campaignId: data.campaignId, farmer: data.farmer },
      'Campaign registered',
    );
  }

  private async handleCampaignEscrowLinked(parsed: ParsedEvent): Promise<void> {
    const data = parsed.data as unknown as CampaignEscrowLinkedData;
    await this.prisma.campaign.update({
      where: { id: data.campaignId },
      data: { escrowContract: data.escrowContract, farmer: data.farmer },
    });
    this.logger.log(
      { campaignId: data.campaignId, escrowContract: data.escrowContract },
      'Campaign escrow linked',
    );
  }

  private async handleCampaignStatusUpdated(
    parsed: ParsedEvent,
  ): Promise<void> {
    const data = parsed.data as unknown as CampaignStatusUpdatedData;
    if (!data.newStatus) {
      // Activity-log mirror shape - no concrete status value to apply.
      return;
    }
    await this.prisma.campaign.update({
      where: { id: data.campaignId },
      data: { status: data.newStatus },
    });
    this.logger.log(
      { campaignId: data.campaignId, newStatus: data.newStatus },
      'Campaign status updated',
    );
  }

  private async handleFarmerRegistered(parsed: ParsedEvent): Promise<void> {
    const data = parsed.data as unknown as FarmerRegisteredData;
    await this.prisma.user.upsert({
      where: { address: data.farmer },
      update: data.name !== undefined ? { name: data.name } : {},
      create: {
        address: data.farmer,
        name: data.name,
        firstSeenAt: BigInt(data.timestamp),
      },
    });
    this.logger.log({ farmer: data.farmer }, 'Farmer registered');
  }
}
