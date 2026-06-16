use soroban_sdk::{Address, Env};
use crate::types::DataKey;

const DAY_IN_LEDGERS: u32 = 17280;
const INSTANCE_LIFETIME_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
const INSTANCE_BUMP_AMOUNT: u32 = DAY_IN_LEDGERS * 90;

pub fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

pub fn has_admin(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Admin)
}

pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn is_contract_approved(env: &Env, contract: &Address) -> bool {
    let key = DataKey::ApprovedContract(contract.clone());
    env.storage().instance().has(&key)
}

pub fn set_contract_approved(env: &Env, contract: &Address, approved: bool) {
    let key = DataKey::ApprovedContract(contract.clone());
    if approved {
        env.storage().instance().set(&key, &true);
    } else {
        env.storage().instance().remove(&key);
    }
}
