use crate::{
    events, storage,
    types::{ActivityAction, ActivityRecord, DataKey},
};
use soroban_sdk::{Address, Env, Vec};

fn require_authorized(actor: &Address) {
    actor.require_auth();
}

pub fn record_activity(env: &Env, campaign_id: u64, actor: &Address, action_type: ActivityAction) {
    require_authorized(actor);

    let timestamp = env.ledger().timestamp();
    let ledger_sequence = env.ledger().sequence();

    let record = ActivityRecord {
        actor: actor.clone(),
        action_type: action_type.clone(),
        timestamp,
        ledger_sequence,
    };

    let count_key = DataKey::CampaignActivitiesPageCount(campaign_id);
    let page_count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);

    // Append to the last page while it has room; otherwise roll over to a
    // fresh page so no single ledger entry grows past
    // storage::MAX_ACTIVITIES_PER_PAGE. Only the target page is read and
    // rewritten -- never the whole activity history.
    let page_index = if page_count == 0 {
        0
    } else {
        let last_page_key = DataKey::CampaignActivitiesPage(campaign_id, page_count - 1);
        let last_page: Vec<ActivityRecord> = env
            .storage()
            .persistent()
            .get(&last_page_key)
            .unwrap_or(Vec::new(env));
        if last_page.len() >= storage::MAX_ACTIVITIES_PER_PAGE {
            page_count
        } else {
            page_count - 1
        }
    };

    let page_key = DataKey::CampaignActivitiesPage(campaign_id, page_index);
    let mut page: Vec<ActivityRecord> = env
        .storage()
        .persistent()
        .get(&page_key)
        .unwrap_or(Vec::new(env));
    page.push_back(record.clone());
    env.storage().persistent().set(&page_key, &page);
    storage::extend_persistent_ttl(env, &page_key);

    let new_page_count = page_index + 1;
    if new_page_count != page_count {
        env.storage().persistent().set(&count_key, &new_page_count);
    }
    storage::extend_persistent_ttl(env, &count_key);

    storage::extend_instance_ttl(env);
    events::activity_recorded(env, campaign_id, record);
}

pub fn get_campaign_activities_page_count(env: &Env, campaign_id: u64) -> u32 {
    let key = DataKey::CampaignActivitiesPageCount(campaign_id);
    env.storage().persistent().get(&key).unwrap_or(0)
}

pub fn get_campaign_activities_page(env: &Env, campaign_id: u64, page: u32) -> Vec<ActivityRecord> {
    let key = DataKey::CampaignActivitiesPage(campaign_id, page);
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env))
}

/// Returns every activity for `campaign_id` in chronological (insertion)
/// order by concatenating all pages. For bounded reads, use
/// `get_campaign_activities_page` together with
/// `get_campaign_activities_page_count` instead.
pub fn get_campaign_activities(env: &Env, campaign_id: u64) -> Vec<ActivityRecord> {
    let page_count = get_campaign_activities_page_count(env, campaign_id);
    let mut activities = Vec::new(env);
    for page_index in 0..page_count {
        let page = get_campaign_activities_page(env, campaign_id, page_index);
        for record in page.iter() {
            activities.push_back(record);
        }
    }
    activities
}
