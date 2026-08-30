#![no_std]

mod activity;
mod admin;
mod campaign;
mod escrow;
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

    /// Number of activity pages (0-based indices `0..page_count`) for a
    /// campaign. Use with `get_campaign_activities_page` for bounded reads;
    /// `get_campaign_activities` concatenates all pages.
    pub fn get_campaign_activity_page_count(env: Env, campaign_id: u64) -> u32 {
        activity::get_campaign_activities_page_count(&env, campaign_id)
    }

    /// A single page (at most `storage::MAX_ACTIVITIES_PER_PAGE` records) of
    /// a campaign's activity log. Pages are 0-based and ordered chronologically.
    pub fn get_campaign_activities_page(
        env: Env,
        campaign_id: u64,
        page: u32,
    ) -> Vec<ActivityRecord> {
        activity::get_campaign_activities_page(&env, campaign_id, page)
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

    pub fn get_campaign_record(env: Env, campaign_id: u64) -> Option<CampaignRecord> {
        campaign::get_campaign_record(&env, campaign_id)
    }

    pub fn get_campaigns_by_farmer(env: Env, farmer: Address) -> Vec<u64> {
        campaign::get_campaigns_by_farmer(&env, &farmer)
    }

    /// Number of campaign-id pages (0-based indices `0..page_count`) for a
    /// farmer. Use with `get_campaigns_by_farmer_page` for bounded reads.
    pub fn get_farmer_campaigns_page_count(env: Env, farmer: Address) -> u32 {
        campaign::get_campaigns_by_farmer_page_count(&env, &farmer)
    }

    /// A single page (at most `storage::MAX_FARMER_CAMPAIGNS_PER_PAGE` ids)
    /// of a farmer's campaign list. Pages are 0-based and ordered by link time.
    pub fn get_campaigns_by_farmer_page(env: Env, farmer: Address, page: u32) -> Vec<u64> {
        campaign::get_campaigns_by_farmer_page(&env, &farmer, page)
    }
    /// Permissionless: re-checks the linked escrow contract's real status
    /// and self-heals the registry's mirrored status if it has drifted.
    /// Returns true if drift was found and corrected.
    pub fn reconcile_campaign_status(env: Env, campaign_id: u64) -> bool {
        campaign::reconcile_campaign_status(&env, campaign_id)
    }
}

#[cfg(test)]
mod test;
