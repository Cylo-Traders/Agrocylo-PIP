use soroban_sdk::{Address, Env};
use crate::{events, storage};

pub fn initialize(env: &Env, admin: &Address) {
    if storage::has_admin(env) {
        panic!("admin already initialized");
    }

    admin.require_auth();
    storage::set_admin(env, admin);
    storage::extend_instance_ttl(env);
}

pub fn require_admin(env: &Env) {
    let admin = storage::get_admin(env);
    admin.require_auth();
}

pub fn update_admin(env: &Env, new_admin: &Address) {
    require_admin(env);
    
    let old_admin = storage::get_admin(env);
    storage::set_admin(env, new_admin);
    storage::extend_instance_ttl(env);
    
    events::admin_updated(env, old_admin, new_admin.clone());
}

pub fn get_admin(env: &Env) -> Address {
    storage::get_admin(env)
}

pub fn approve_contract(env: &Env, contract: &Address) {
    require_admin(env);
    storage::set_contract_approved(env, contract, true);
    storage::extend_instance_ttl(env);
    events::contract_approved(env, contract.clone());
}

pub fn revoke_contract(env: &Env, contract: &Address) {
    require_admin(env);
    storage::set_contract_approved(env, contract, false);
    storage::extend_instance_ttl(env);
    events::contract_revoked(env, contract.clone());
}

pub fn is_contract_approved(env: &Env, contract: &Address) -> bool {
    storage::is_contract_approved(env, contract)
}
