use crate::{events, storage};
use crate::types::{CampaignInfo, CampaignRecord, CampaignStatus};
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
    storage::extend_instance_ttl(env);

    events::campaign_registered(env, campaign_id, farmer, title);
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
    storage::extend_instance_ttl(env);

    events::campaign_escrow_linked(env, campaign_id, farmer.clone(), escrow_contract.clone());
}

pub fn update_campaign_status(
    env: &Env,
    campaign_id: u64,
    caller: &Address,
    new_status: CampaignStatus,
) {
    let mut record = storage::get_campaign_record(env, campaign_id);

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

pub fn get_campaign_record(env: &Env, campaign_id: u64) -> CampaignRecord {
    storage::get_campaign_record(env, campaign_id)
}

pub fn has_campaign_record(env: &Env, campaign_id: u64) -> bool {
    storage::has_campaign_record(env, campaign_id)
}

pub fn get_campaigns_by_farmer(env: &Env, farmer: &Address) -> Vec<u64> {
    storage::get_farmer_campaigns(env, farmer)
}
