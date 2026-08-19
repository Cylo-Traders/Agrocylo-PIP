#![no_std]

mod activity;
mod admin;
mod campaign;
mod events;
mod farmer;
mod storage;
mod types;

pub use types::*;

use soroban_sdk::{contract, contractimpl, Address, Env, String, Symbol, Vec};

#[contract]
pub struct RegistryContract;

#[contractimpl]
impl RegistryContract {
    pub fn initialize(env: Env, admin: Address) {
        admin::initialize(&env, &admin);
    }

    pub fn update_admin(env: Env, new_admin: Address) {
        admin::update_admin(&env, &new_admin);
    }

    pub fn get_admin(env: Env) -> Address {
        admin::get_admin(&env)
    }

    pub fn approve_contract(env: Env, contract: Address) {
        admin::approve_contract(&env, &contract);
    }

    pub fn revoke_contract(env: Env, contract: Address) {
        admin::revoke_contract(&env, &contract);
    }

    pub fn is_contract_approved(env: Env, contract: Address) -> bool {
        admin::is_contract_approved(&env, &contract)
    }

    pub fn register_farmer(env: Env, farmer: Address, name: String, location: String) {
        farmer::register_farmer(&env, farmer, name, location);
    }

    pub fn get_farmer(env: Env, farmer: Address) -> Option<FarmerProfile> {
        farmer::get_farmer(&env, &farmer)
    }

    pub fn register_campaign(
        env: Env,
        campaign_id: u64,
        farmer: Address,
        title: String,
        description: String,
    ) {
        campaign::register_campaign(&env, campaign_id, farmer, title, description);
    }

    pub fn get_campaign(env: Env, campaign_id: u64) -> Option<CampaignInfo> {
        campaign::get_campaign(&env, campaign_id)
    }

    pub fn record_activity(
        env: Env,
        campaign_id: u64,
        actor: Address,
        action_type: ActivityAction,
    ) {
        activity::record_activity(&env, campaign_id, &actor, action_type);
    }

    pub fn get_campaign_activities(env: Env, campaign_id: u64) -> Vec<ActivityRecord> {
        activity::get_campaign_activities(&env, campaign_id)
    }

    /// Links a campaign to its ProductionEscrowContract instance and crop/region
    /// metadata, and begins tracking its lifecycle status. Distinct from
    /// `register_campaign`, which stores the farmer-authored title/description.
    pub fn link_campaign_escrow(
        env: Env,
        campaign_id: u64,
        farmer: Address,
        escrow_contract: Address,
        crop_metadata: Symbol,
        region_metadata: Symbol,
    ) {
        campaign::link_campaign_escrow(
            &env,
            campaign_id,
            &farmer,
            &escrow_contract,
            crop_metadata,
            region_metadata,
        );
    }

    pub fn update_campaign_status(
        env: Env,
        campaign_id: u64,
        caller: Address,
        new_status: CampaignStatus,
    ) {
        campaign::update_campaign_status(&env, campaign_id, &caller, new_status);
    }

    pub fn get_campaign_record(env: Env, campaign_id: u64) -> CampaignRecord {
        campaign::get_campaign_record(&env, campaign_id)
    }

    pub fn get_campaigns_by_farmer(env: Env, farmer: Address) -> Vec<u64> {
        campaign::get_campaigns_by_farmer(&env, &farmer)
    }

    /// Total number of campaigns known to the registry. Use with
    /// `get_campaign_ids` to page through every campaign.
    pub fn get_campaign_count(env: Env) -> u64 {
        campaign::get_campaign_count(&env)
    }

    /// Campaign ids in registration order for `[offset, offset + limit)`.
    ///
    /// This is the supported way to enumerate campaigns — it does not depend
    /// on RPC event retention the way event-log scanning does. `limit` is
    /// clamped to 100; an `offset` at or past the end returns an empty vector.
    pub fn get_campaign_ids(env: Env, offset: u64, limit: u32) -> Vec<u64> {
        campaign::get_campaign_ids(&env, offset, limit)
    }

    /// Total number of registered farmers.
    pub fn get_farmer_count(env: Env) -> u64 {
        farmer::get_farmer_count(&env)
    }

    /// Farmer addresses in registration order, with the same paging and
    /// clamping rules as `get_campaign_ids`.
    pub fn get_farmers(env: Env, offset: u64, limit: u32) -> Vec<Address> {
        farmer::get_farmers(&env, offset, limit)
    }
}

#[cfg(test)]
mod test;
