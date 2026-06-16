#![no_std]

mod storage;
mod types;
mod events;
mod admin;
mod activity;

pub use types::*;

use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

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
}

#[cfg(test)]
mod test;
