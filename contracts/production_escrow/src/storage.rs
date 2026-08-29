use crate::{Campaign, DataKey, Dispute, HarvestRecord, TrancheList};
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
    env.storage().persistent().extend_ttl(
        key,
        PERSISTENT_LIFETIME_THRESHOLD,
        PERSISTENT_BUMP_AMOUNT,
    );
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

pub fn get_registry(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Registry)
}

pub fn set_registry(env: &Env, registry: &Address) {
    env.storage().instance().set(&DataKey::Registry, registry);
}

pub fn has_campaign(env: &Env, campaign_id: u64) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::Campaign(campaign_id))
}

pub fn get_campaign(env: &Env, campaign_id: u64) -> Option<Campaign> {
    let key = DataKey::Campaign(campaign_id);
    let campaign = env.storage().persistent().get(&key);
    if campaign.is_some() {
        extend_persistent_ttl(env, &key);
    }
    campaign
}

pub fn set_campaign(env: &Env, campaign_id: u64, campaign: &Campaign) {
    let key = DataKey::Campaign(campaign_id);
    env.storage().persistent().set(&key, campaign);
    extend_persistent_ttl(env, &key);
}

pub fn get_dispute(env: &Env, campaign_id: u64) -> Option<Dispute> {
    let key = DataKey::Dispute(campaign_id);
    let dispute = env.storage().persistent().get(&key);
    if dispute.is_some() {
        extend_persistent_ttl(env, &key);
    }
    dispute
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

pub fn get_harvest_record(env: &Env, campaign_id: u64) -> Option<HarvestRecord> {
    let key = DataKey::HarvestRecord(campaign_id);
    let record = env.storage().persistent().get(&key);
    if record.is_some() {
        extend_persistent_ttl(env, &key);
    }
    record
}

pub fn set_harvest_record(env: &Env, campaign_id: u64, record: &HarvestRecord) {
    let key = DataKey::HarvestRecord(campaign_id);
    env.storage().persistent().set(&key, record);
    extend_persistent_ttl(env, &key);
}
