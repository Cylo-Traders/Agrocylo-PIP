use crate::escrow::ProductionEscrowContractClient;
use crate::types::{CampaignInfo, CampaignRecord, CampaignStatus};
use crate::{events, storage};
use escrow_types::CampaignStatus as EscrowCampaignStatus;
use soroban_sdk::{Address, Env, String, Symbol, Vec};

pub fn register_campaign(
    env: &Env,
    campaign_id: u64,
    farmer: Address,
    title: String,
    description: String,
) {
    farmer.require_auth();

    if storage::has_campaign(env, campaign_id) {
        panic!("campaign already registered");
    }

    let campaign = CampaignInfo {
        id: campaign_id,
        farmer: farmer.clone(),
        title: title.clone(),
        description,
        created_at: env.ledger().timestamp(),
    };

    storage::set_campaign(env, &campaign);
    storage::index_campaign(env, campaign_id);
    storage::extend_instance_ttl(env);

    events::campaign_registered(env, campaign_id, farmer, title);
}

pub fn update_campaign_metadata(
    env: &Env,
    campaign_id: u64,
    farmer: Address,
    title: String,
    description: String,
) {
    farmer.require_auth();

    let mut campaign = storage::get_campaign(env, campaign_id)
        .unwrap_or_else(|| panic!("campaign not registered"));

    if campaign.farmer != farmer {
        panic!("farmer does not match registered campaign");
    }

    if let Some(record) = storage::get_campaign_record(env, campaign_id) {
        match record.status {
            CampaignStatus::Active | CampaignStatus::Funding => {}
            _ => panic!("cannot update metadata: campaign has left active/funding status"),
        }
    }

    campaign.title = title.clone();
    campaign.description = description;

    storage::set_campaign(env, &campaign);
    storage::extend_instance_ttl(env);

    events::campaign_metadata_updated(env, campaign_id, farmer, title);
}

pub fn get_campaign(env: &Env, campaign_id: u64) -> Option<CampaignInfo> {
    storage::get_campaign(env, campaign_id)
}

/// Links a campaign to its ProductionEscrowContract instance and crop/region
/// metadata, and begins tracking its lifecycle status. Distinct from
/// `register_campaign`, which stores the farmer-authored title/description.
pub fn link_campaign_escrow(
    env: &Env,
    campaign_id: u64,
    farmer: &Address,
    escrow_contract: &Address,
    crop_metadata: Symbol,
    region_metadata: Symbol,
) {
    if storage::has_campaign_record(env, campaign_id) {
        panic!("campaign already linked");
    }

    // Must have been register_campaign'd first, and by the same farmer --
    // otherwise this would create a CampaignRecord with no corresponding
    // title/description, or let a second, disagreeing farmer address link
    // against someone else's registered campaign id.
    let campaign_info = storage::get_campaign(env, campaign_id)
        .unwrap_or_else(|| panic!("campaign not registered"));
    if campaign_info.farmer != *farmer {
        panic!("farmer does not match registered campaign");
    }

    // Approved escrow contracts can link on behalf of the farmer (cross-contract flow);
    // otherwise the farmer must authorize directly.
    if storage::is_contract_approved(env, escrow_contract) {
        escrow_contract.require_auth();
    } else {
        farmer.require_auth();
    }

    let record = CampaignRecord {
        campaign_id,
        farmer: farmer.clone(),
        escrow_contract: escrow_contract.clone(),
        crop_metadata,
        region_metadata,
        status: CampaignStatus::Active,
    };
    storage::set_campaign_record(env, campaign_id, &record);
    storage::add_farmer_campaign(env, farmer, campaign_id);
    // A campaign can be linked without ever going through `register_campaign`,
    // so index here too; `index_campaign` is idempotent.
    storage::index_campaign(env, campaign_id);
    storage::extend_instance_ttl(env);

    events::campaign_escrow_linked(env, campaign_id, farmer.clone(), escrow_contract.clone());
}

pub fn update_campaign_status(
    env: &Env,
    campaign_id: u64,
    caller: &Address,
    new_status: CampaignStatus,
) {
    let mut record = storage::get_campaign_record(env, campaign_id)
        .unwrap_or_else(|| panic!("campaign record not found"));

    let is_admin = storage::get_admin(env) == *caller;
    let is_registered_escrow = record.escrow_contract == *caller;
    if !is_admin && !is_registered_escrow {
        panic!("unauthorized: caller is not the registered escrow contract or admin");
    }
    caller.require_auth();

    let prev_status = record.status.clone();
    record.status = new_status.clone();
    storage::set_campaign_record(env, campaign_id, &record);
    storage::extend_instance_ttl(env);

    events::campaign_status_updated(env, campaign_id, prev_status, new_status);
}

pub fn get_campaign_record(env: &Env, campaign_id: u64) -> Option<CampaignRecord> {
    storage::get_campaign_record(env, campaign_id)
}
/// Maps the escrow contract's `CampaignStatus` onto the registry's own
/// `CampaignStatus` type. Kept as two distinct enums (rather than reusing
/// production_escrow's type directly as the record field type) so the
/// registry's on-chain schema is not silently reshaped by escrow changes.
fn map_escrow_status(status: &EscrowCampaignStatus) -> CampaignStatus {
    match status {
        EscrowCampaignStatus::Active => CampaignStatus::Active,
        EscrowCampaignStatus::Funding => CampaignStatus::Funding,
        EscrowCampaignStatus::Funded => CampaignStatus::Funded,
        EscrowCampaignStatus::InProduction => CampaignStatus::InProduction,
        EscrowCampaignStatus::Harvested => CampaignStatus::Harvested,
        EscrowCampaignStatus::Disputed => CampaignStatus::Disputed,
        EscrowCampaignStatus::Resolved => CampaignStatus::Resolved,
        EscrowCampaignStatus::Settled => CampaignStatus::Settled,
        EscrowCampaignStatus::Failed => CampaignStatus::Failed,
    }
}

/// Permissionless reconciliation: re-derives the campaign's true status by
/// making a cross-contract call into its linked `ProductionEscrowContract`
/// and comparing that against the registry's mirrored `CampaignRecord.status`.
///
/// Nothing on-chain otherwise enforces that the mirror stays in sync --
/// every `update_campaign_status` call today depends on an off-chain
/// orchestrator invoking both contracts in order after each escrow
/// transition. If that orchestrator crashes, is buggy, or is never
/// deployed for a given environment, the mirror can silently and
/// permanently diverge with no on-chain signal. See INTEGRATION.md,
/// "Failure modes".
///
/// No authorization is required: this does not trust any caller-supplied
/// status, only what the escrow contract itself reports for
/// `get_campaign(campaign_id).status`, which is the real source of truth.
/// Being permissionless means anyone -- a monitoring bot, a farmer, an
/// investor -- can self-heal drift as soon as they notice it, instead of
/// waiting on the orchestrator or the admin.
///
/// Returns `true` if drift was found and corrected, `false` if the mirror
/// already matched.
pub fn reconcile_campaign_status(env: &Env, campaign_id: u64) -> bool {
    let mut record = storage::get_campaign_record(env, campaign_id)
        .unwrap_or_else(|| panic!("campaign record not found"));

    let escrow_client = ProductionEscrowContractClient::new(env, &record.escrow_contract);
    let escrow_campaign = escrow_client
        .get_campaign(&campaign_id)
        .unwrap_or_else(|| panic!("linked escrow campaign not found"));
    let true_status = map_escrow_status(&escrow_campaign.status);

    if record.status == true_status {
        return false;
    }

    let prev_status = record.status.clone();
    record.status = true_status.clone();
    storage::set_campaign_record(env, campaign_id, &record);
    storage::extend_instance_ttl(env);

    events::campaign_status_reconciled(env, campaign_id, prev_status, true_status);
    true
}

pub fn get_campaigns_by_farmer(env: &Env, farmer: &Address) -> Vec<u64> {
    storage::get_farmer_campaigns(env, farmer)
}

pub fn get_campaigns_by_farmer_page_count(env: &Env, farmer: &Address) -> u32 {
    storage::get_farmer_campaigns_page_count(env, farmer)
}

pub fn get_campaigns_by_farmer_page(env: &Env, farmer: &Address, page: u32) -> Vec<u64> {
    storage::get_farmer_campaigns_page(env, farmer, page)
}

pub fn get_campaign_count(env: &Env) -> u64 {
    storage::get_campaign_count(env)
}

pub fn get_campaign_ids(env: &Env, offset: u64, limit: u32) -> Vec<u64> {
    storage::get_campaign_ids(env, offset, limit)
}
