use soroban_sdk::{Address, Env, Vec};
use crate::{admin, events, storage, types::{ActivityAction, ActivityRecord, DataKey}};

fn require_authorized(env: &Env, actor: &Address) {
    let is_admin = storage::get_admin(env) == *actor;
    let is_approved = storage::is_contract_approved(env, actor);
    
    if !is_admin && !is_approved {
        actor.require_auth();
    }
}

pub fn record_activity(
    env: &Env,
    campaign_id: u64,
    actor: &Address,
    action_type: ActivityAction,
) {
    require_authorized(env, actor);
    
    let timestamp = env.ledger().timestamp();
    let ledger_sequence = env.ledger().sequence();
    
    let record = ActivityRecord {
        actor: actor.clone(),
        action_type: action_type.clone(),
        timestamp,
        ledger_sequence,
    };
    
    let key = DataKey::CampaignActivities(campaign_id);
    let mut activities: Vec<ActivityRecord> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env));
    
    activities.push_back(record.clone());
    
    env.storage().persistent().set(&key, &activities);
    
    let lifetime_threshold = 17280 * 30;
    let bump_amount = 17280 * 90;
    env.storage()
        .persistent()
        .extend_ttl(&key, lifetime_threshold, bump_amount);
    
    storage::extend_instance_ttl(env);
    events::activity_recorded(env, campaign_id, record);
}

pub fn get_campaign_activities(env: &Env, campaign_id: u64) -> Vec<ActivityRecord> {
    let key = DataKey::CampaignActivities(campaign_id);
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env))
}
