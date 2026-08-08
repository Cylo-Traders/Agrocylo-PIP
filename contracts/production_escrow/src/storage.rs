use crate::types::{Campaign, DataKey, Dispute, HarvestRecord, TrancheList};
use soroban_sdk::{Address, Env, Vec};

const DAY_IN_LEDGERS: u32 = 17280;
const INSTANCE_LIFETIME_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
const INSTANCE_BUMP_AMOUNT: u32 = DAY_IN_LEDGERS * 90;
const PERSISTENT_LIFETIME_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
const PERSISTENT_BUMP_AMOUNT: u32 = DAY_IN_LEDGERS * 90;

pub fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

fn extend_persistent_ttl(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_LIFETIME_THRESHOLD, PERSISTENT_BUMP_AMOUNT);
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

pub fn has_campaign(env: &Env, campaign_id: u64) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::Campaign(campaign_id))
}

/// Returns the campaign if it exists, otherwise `None`.
/// Matches the `RegistryContract` convention for public lookups so clients can
/// distinguish "not found" from host panics.
pub fn get_campaign(env: &Env, campaign_id: u64) -> Option<Campaign> {
    let key = DataKey::Campaign(campaign_id);
    let campaign: Campaign = env.storage().persistent().get(&key)?;
    extend_persistent_ttl(env, &key);
    Some(campaign)
}

pub fn set_campaign(env: &Env, campaign_id: u64, campaign: &Campaign) {
    let key = DataKey::Campaign(campaign_id);
    env.storage().persistent().set(&key, campaign);
    extend_persistent_ttl(env, &key);
}

/// Returns the dispute for `campaign_id` if one was opened, otherwise `None`.
pub fn get_dispute(env: &Env, campaign_id: u64) -> Option<Dispute> {
    let key = DataKey::Dispute(campaign_id);
    let dispute: Dispute = env.storage().persistent().get(&key)?;
    extend_persistent_ttl(env, &key);
    Some(dispute)
}

pub fn set_dispute(env: &Env, campaign_id: u64, dispute: &Dispute) {
    let key = DataKey::Dispute(campaign_id);
    env.storage().persistent().set(&key, dispute);
    extend_persistent_ttl(env, &key);
}

pub fn get_contribution(env: &Env, campaign_id: u64, investor: &Address) -> i128 {
    let key = DataKey::Contribution(campaign_id, investor.clone());
    let amount = env.storage().persistent().get(&key).unwrap_or(0);
    if env.storage().persistent().has(&key) {
        extend_persistent_ttl(env, &key);
    }
    amount
}

pub fn set_contribution(env: &Env, campaign_id: u64, investor: &Address, amount: i128) {
    let key = DataKey::Contribution(campaign_id, investor.clone());
    env.storage().persistent().set(&key, &amount);
    extend_persistent_ttl(env, &key);
}

pub fn get_tranches(env: &Env, campaign_id: u64) -> TrancheList {
    let key = DataKey::Tranches(campaign_id);
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env))
}

pub fn set_tranches(env: &Env, campaign_id: u64, tranches: &TrancheList) {
    let key = DataKey::Tranches(campaign_id);
    env.storage().persistent().set(&key, tranches);
    extend_persistent_ttl(env, &key);
}

/// Returns the harvest record if harvest was reported, otherwise `None`.
pub fn get_harvest_record(env: &Env, campaign_id: u64) -> Option<HarvestRecord> {
    let key = DataKey::HarvestRecord(campaign_id);
    let record: HarvestRecord = env.storage().persistent().get(&key)?;
    extend_persistent_ttl(env, &key);
    Some(record)
}

pub fn set_harvest_record(env: &Env, campaign_id: u64, record: &HarvestRecord) {
    let key = DataKey::HarvestRecord(campaign_id);
    env.storage().persistent().set(&key, record);
    extend_persistent_ttl(env, &key);
}
