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

/// Upper bound on how many entries one paginated read may return. Keeps the
/// response size bounded regardless of how large the registry grows.
pub const MAX_PAGE_LIMIT: u32 = 100;

pub fn get_campaign_count(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::CampaignCount)
        .unwrap_or(0)
}

pub fn get_farmer_count(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::FarmerCount)
        .unwrap_or(0)
}

fn is_campaign_indexed(env: &Env, campaign_id: u64) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::CampaignIndexed(campaign_id))
}

/// Appends `campaign_id` to the enumeration index unless it is already there.
///
/// Idempotent by design: both `register_campaign` and `link_campaign_escrow`
/// can be the first call to mention a campaign, and either may be called
/// without the other, so both index — but a campaign is only ever counted
/// once.
pub fn index_campaign(env: &Env, campaign_id: u64) {
    if is_campaign_indexed(env, campaign_id) {
        return;
    }

    let count = get_campaign_count(env);
    let index_key = DataKey::CampaignIndex(count);
    env.storage().persistent().set(&index_key, &campaign_id);
    extend_persistent_ttl(env, &index_key);

    let marker_key = DataKey::CampaignIndexed(campaign_id);
    env.storage().persistent().set(&marker_key, &true);
    extend_persistent_ttl(env, &marker_key);

    env.storage()
        .instance()
        .set(&DataKey::CampaignCount, &(count + 1));
}

/// Appends `farmer` to the enumeration index. Callers must guard against
/// re-registration first (`register_farmer` panics on a duplicate), so this is
/// not idempotent.
pub fn index_farmer(env: &Env, farmer: &Address) {
    let count = get_farmer_count(env);
    let index_key = DataKey::FarmerIndex(count);
    env.storage().persistent().set(&index_key, farmer);
    extend_persistent_ttl(env, &index_key);

    env.storage()
        .instance()
        .set(&DataKey::FarmerCount, &(count + 1));
}

/// Returns campaign ids in registration order for the half-open range
/// `[offset, offset + limit)`, clamped to `MAX_PAGE_LIMIT` and to the number
/// of campaigns that actually exist.
pub fn get_campaign_ids(env: &Env, offset: u64, limit: u32) -> Vec<u64> {
    let count = get_campaign_count(env);
    let mut ids = Vec::new(env);

    if offset >= count {
        return ids;
    }

    let capped = if limit > MAX_PAGE_LIMIT {
        MAX_PAGE_LIMIT
    } else {
        limit
    };
    let end = core::cmp::min(offset + capped as u64, count);

    for index in offset..end {
        if let Some(id) = env
            .storage()
            .persistent()
            .get::<DataKey, u64>(&DataKey::CampaignIndex(index))
        {
            ids.push_back(id);
        }
    }

    ids
}

/// Returns farmer addresses in registration order, with the same clamping
/// rules as `get_campaign_ids`.
pub fn get_farmer_addresses(env: &Env, offset: u64, limit: u32) -> Vec<Address> {
    let count = get_farmer_count(env);
    let mut farmers = Vec::new(env);

    if offset >= count {
        return farmers;
    }

    let capped = if limit > MAX_PAGE_LIMIT {
        MAX_PAGE_LIMIT
    } else {
        limit
    };
    let end = core::cmp::min(offset + capped as u64, count);

    for index in offset..end {
        if let Some(addr) = env
            .storage()
            .persistent()
            .get::<DataKey, Address>(&DataKey::FarmerIndex(index))
        {
            farmers.push_back(addr);
        }
    }

    farmers
}
