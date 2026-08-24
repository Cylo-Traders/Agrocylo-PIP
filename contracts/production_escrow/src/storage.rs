use crate::types::{Campaign, DataKey, Dispute, HarvestRecord, TrancheList};
use soroban_sdk::{Address, Env, Vec};

/// Approximate number of ledgers in a 24h period on Stellar (~5s/ledger).
pub const DAY_IN_LEDGERS: u32 = 17280;
const INSTANCE_LIFETIME_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
const INSTANCE_BUMP_AMOUNT: u32 = DAY_IN_LEDGERS * 90;
/// If a persistent entry's remaining TTL is below this many ledgers (~30 days),
/// the next write/touch extends it. See the TTL / archival section of README.md.
pub const PERSISTENT_LIFETIME_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
/// Target remaining TTL after a bump (~90 days of ledgers).
pub const PERSISTENT_BUMP_AMOUNT: u32 = DAY_IN_LEDGERS * 90;

/// Panic message used when a mutating path needs a campaign that is either
/// missing or whose persistent entry has been archived. Public getters return
/// `Option` instead; this string is for write-path preconditions.
pub const MISSING_OR_ARCHIVED_CAMPAIGN: &str = "campaign not found (missing or archived; restore with RestoreFootprintOp or keep alive via touch_campaign)";
pub const MISSING_OR_ARCHIVED_DISPUTE: &str = "dispute not found (missing or archived; restore with RestoreFootprintOp or keep alive via touch_campaign)";

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

fn extend_if_present(env: &Env, key: &DataKey) {
    if env.storage().persistent().has(key) {
        extend_persistent_ttl(env, key);
    }
}

/// Permissionless keep-alive: extends TTL on every persistent campaign entry
/// that currently exists (`Campaign`, and if present `Dispute`, `Tranches`,
/// `HarvestRecord`) plus the contract instance. Does not change any stored
/// value. Contribution keys are per-investor and are not enumerated here.
///
/// Panics if the campaign key is missing (never created) or unreadable
/// because it has already been archived — in the archived case the host
/// fails the read and a `RestoreFootprintOp` is required first.
pub fn touch_campaign(env: &Env, campaign_id: u64) {
    let campaign_key = DataKey::Campaign(campaign_id);
    if !env.storage().persistent().has(&campaign_key) {
        panic!("{}", MISSING_OR_ARCHIVED_CAMPAIGN);
    }
    extend_persistent_ttl(env, &campaign_key);
    extend_if_present(env, &DataKey::Dispute(campaign_id));
    extend_if_present(env, &DataKey::Tranches(campaign_id));
    extend_if_present(env, &DataKey::HarvestRecord(campaign_id));
    extend_instance_ttl(env);
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

pub fn get_campaign(env: &Env, campaign_id: u64) -> Option<Campaign> {
    let key = DataKey::Campaign(campaign_id);
    let campaign = env.storage().persistent().get(&key);
    if campaign.is_some() {
        extend_persistent_ttl(env, &key);
    }
    campaign
}

/// Like `get_campaign`, but panics with an archival-aware message when the
/// entry is missing. Used by mutating methods that require the campaign to
/// already exist.
pub fn require_campaign(env: &Env, campaign_id: u64) -> Campaign {
    get_campaign(env, campaign_id).unwrap_or_else(|| panic!("{}", MISSING_OR_ARCHIVED_CAMPAIGN))
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

pub fn require_dispute(env: &Env, campaign_id: u64) -> Dispute {
    get_dispute(env, campaign_id).unwrap_or_else(|| panic!("{}", MISSING_OR_ARCHIVED_DISPUTE))
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
