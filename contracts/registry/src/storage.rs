use crate::types::{CampaignInfo, CampaignRecord, DataKey, FarmerProfile};
use soroban_sdk::{Address, Env, Vec};

const DAY_IN_LEDGERS: u32 = 17280;
const INSTANCE_LIFETIME_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
const INSTANCE_BUMP_AMOUNT: u32 = DAY_IN_LEDGERS * 90;
const PERSISTENT_LIFETIME_THRESHOLD: u32 = DAY_IN_LEDGERS * 30;
const PERSISTENT_BUMP_AMOUNT: u32 = DAY_IN_LEDGERS * 90;

/// Maximum number of `ActivityRecord`s stored per `CampaignActivitiesPage`.
///
/// The campaign activity log is stored as a chain of fixed-size pages rather
/// than one ever-growing `Vec`. Bounding each page keeps every ledger entry
/// well under Soroban's maximum entry size regardless of how long or
/// contentious a campaign's history gets; appends only touch the current
/// (last) page, and reads can page through history instead of loading a
/// single giant entry. See `activity.rs`.
pub const MAX_ACTIVITIES_PER_PAGE: u32 = 100;

/// Maximum number of campaign ids stored per `FarmerCampaignsPage`.
///
/// Same bounded-page rationale as `MAX_ACTIVITIES_PER_PAGE`: a prolific
/// farmer's campaign list is spread across multiple pages instead of one
/// unbounded read-modify-write entry. See `add_farmer_campaign`.
pub const MAX_FARMER_CAMPAIGNS_PER_PAGE: u32 = 100;

pub fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

pub fn extend_persistent_ttl(env: &Env, key: &DataKey) {
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

pub fn has_farmer(env: &Env, farmer: &Address) -> bool {
    let key = DataKey::Farmer(farmer.clone());
    env.storage().persistent().has(&key)
}

pub fn get_farmer(env: &Env, farmer: &Address) -> Option<FarmerProfile> {
    let key = DataKey::Farmer(farmer.clone());
    env.storage().persistent().get(&key)
}

pub fn set_farmer(env: &Env, profile: &FarmerProfile) {
    let key = DataKey::Farmer(profile.address.clone());
    env.storage().persistent().set(&key, profile);
    extend_persistent_ttl(env, &key);
}

pub fn has_campaign(env: &Env, campaign_id: u64) -> bool {
    let key = DataKey::Campaign(campaign_id);
    env.storage().persistent().has(&key)
}

pub fn get_campaign(env: &Env, campaign_id: u64) -> Option<CampaignInfo> {
    let key = DataKey::Campaign(campaign_id);
    env.storage().persistent().get(&key)
}

pub fn set_campaign(env: &Env, campaign: &CampaignInfo) {
    let key = DataKey::Campaign(campaign.id);
    env.storage().persistent().set(&key, campaign);
    extend_persistent_ttl(env, &key);
}

pub fn has_campaign_record(env: &Env, campaign_id: u64) -> bool {
    let key = DataKey::CampaignRecord(campaign_id);
    env.storage().persistent().has(&key)
}

pub fn get_campaign_record(env: &Env, campaign_id: u64) -> Option<CampaignRecord> {
    let key = DataKey::CampaignRecord(campaign_id);
    let record = env.storage().persistent().get(&key);
    if record.is_some() {
        extend_persistent_ttl(env, &key);
    }
    record
}

pub fn set_campaign_record(env: &Env, campaign_id: u64, record: &CampaignRecord) {
    let key = DataKey::CampaignRecord(campaign_id);
    env.storage().persistent().set(&key, record);
    extend_persistent_ttl(env, &key);
}

pub fn get_farmer_campaigns_page_count(env: &Env, farmer: &Address) -> u32 {
    let key = DataKey::FarmerCampaignsPageCount(farmer.clone());
    env.storage().persistent().get(&key).unwrap_or(0)
}

pub fn get_farmer_campaigns_page(env: &Env, farmer: &Address, page: u32) -> Vec<u64> {
    let key = DataKey::FarmerCampaignsPage(farmer.clone(), page);
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env))
}

/// Returns every campaign id for `farmer` in insertion order by concatenating
/// all pages. For bounded reads, use `get_farmer_campaigns_page` together with
/// `get_farmer_campaigns_page_count` instead.
pub fn get_farmer_campaigns(env: &Env, farmer: &Address) -> Vec<u64> {
    let page_count = get_farmer_campaigns_page_count(env, farmer);
    let mut campaigns = Vec::new(env);
    for page_index in 0..page_count {
        let page = get_farmer_campaigns_page(env, farmer, page_index);
        for campaign_id in page.iter() {
            campaigns.push_back(campaign_id);
        }
    }
    campaigns
}

pub fn add_farmer_campaign(env: &Env, farmer: &Address, campaign_id: u64) {
    let count_key = DataKey::FarmerCampaignsPageCount(farmer.clone());
    let page_count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);

    // Append to the last page while it has room; otherwise roll over to a
    // fresh page so no single ledger entry grows past
    // MAX_FARMER_CAMPAIGNS_PER_PAGE. Only the target page is read and
    // rewritten -- never the whole list.
    let page_index = if page_count == 0 {
        0
    } else {
        let last_page_key = DataKey::FarmerCampaignsPage(farmer.clone(), page_count - 1);
        let last_page: Vec<u64> = env
            .storage()
            .persistent()
            .get(&last_page_key)
            .unwrap_or(Vec::new(env));
        if last_page.len() >= MAX_FARMER_CAMPAIGNS_PER_PAGE {
            page_count
        } else {
            page_count - 1
        }
    };

    let page_key = DataKey::FarmerCampaignsPage(farmer.clone(), page_index);
    let mut page: Vec<u64> = env
        .storage()
        .persistent()
        .get(&page_key)
        .unwrap_or(Vec::new(env));
    page.push_back(campaign_id);
    env.storage().persistent().set(&page_key, &page);
    extend_persistent_ttl(env, &page_key);

    let new_page_count = page_index + 1;
    if new_page_count != page_count {
        env.storage().persistent().set(&count_key, &new_page_count);
    }
    extend_persistent_ttl(env, &count_key);
}

pub fn get_campaign_count(env: &Env) -> u64 {
    env.storage()
        .persistent()
        .get(&DataKey::CampaignCount)
        .unwrap_or(0)
}

fn is_campaign_indexed(env: &Env, campaign_id: u64) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::CampaignIndexed(campaign_id))
}

/// Appends `campaign_id` to the flat global campaign index. Idempotent: a
/// campaign that is both `register_campaign`'d and `link_campaign_escrow`'d
/// indexes through here twice, and the second call must be a no-op rather
/// than double-counting or duplicating the entry.
pub fn index_campaign(env: &Env, campaign_id: u64) {
    if is_campaign_indexed(env, campaign_id) {
        return;
    }

    let indexed_key = DataKey::CampaignIndexed(campaign_id);
    env.storage().persistent().set(&indexed_key, &true);
    extend_persistent_ttl(env, &indexed_key);

    let count_key = DataKey::CampaignCount;
    let count = get_campaign_count(env);

    let index_key = DataKey::CampaignByIndex(count);
    env.storage().persistent().set(&index_key, &campaign_id);
    extend_persistent_ttl(env, &index_key);

    env.storage().persistent().set(&count_key, &(count + 1));
    extend_persistent_ttl(env, &count_key);
}

/// Returns up to `limit` campaign ids starting at `offset` (0-based, index
/// order). Indices at or past the current count are simply omitted rather
/// than erroring, so callers can safely page past the end.
pub fn get_campaigns(env: &Env, offset: u64, limit: u32) -> Vec<u64> {
    let count = get_campaign_count(env);
    let mut campaign_ids = Vec::new(env);
    let mut index = offset;
    let mut remaining = limit;
    while remaining > 0 && index < count {
        let key = DataKey::CampaignByIndex(index);
        if let Some(campaign_id) = env.storage().persistent().get(&key) {
            campaign_ids.push_back(campaign_id);
        }
        index += 1;
        remaining -= 1;
    }
    campaign_ids
}

pub fn get_farmer_count(env: &Env) -> u64 {
    env.storage()
        .persistent()
        .get(&DataKey::FarmerCount)
        .unwrap_or(0)
}

/// Appends `farmer` to the flat global farmer index. Unlike `index_campaign`,
/// this does not need to be idempotent: its only call site, `register_farmer`,
/// already guards on `has_farmer` and can run at most once per address.
pub fn index_farmer(env: &Env, farmer: &Address) {
    let count_key = DataKey::FarmerCount;
    let count = get_farmer_count(env);

    let index_key = DataKey::FarmerByIndex(count);
    env.storage().persistent().set(&index_key, farmer);
    extend_persistent_ttl(env, &index_key);

    env.storage().persistent().set(&count_key, &(count + 1));
    extend_persistent_ttl(env, &count_key);
}

/// Returns up to `limit` farmer addresses starting at `offset` (0-based,
/// registration order). Indices at or past the current count are simply
/// omitted rather than erroring, so callers can safely page past the end.
pub fn get_farmer_addresses(env: &Env, offset: u64, limit: u32) -> Vec<Address> {
    let count = get_farmer_count(env);
    let mut addresses = Vec::new(env);
    let mut index = offset;
    let mut remaining = limit;
    while remaining > 0 && index < count {
        let key = DataKey::FarmerByIndex(index);
        if let Some(address) = env.storage().persistent().get(&key) {
            addresses.push_back(address);
        }
        index += 1;
        remaining -= 1;
    }
    addresses
}
