use crate::{events, storage};
use crate::types::FarmerProfile;
use soroban_sdk::{Address, Env, String};

pub fn register_farmer(
    env: &Env,
    farmer: Address,
    name: String,
    location: String,
) {
    farmer.require_auth();

    if storage::has_farmer(env, &farmer) {
        panic!("farmer already registered");
    }

    let profile = FarmerProfile {
        address: farmer.clone(),
        name: name.clone(),
        location,
        registration_time: env.ledger().timestamp(),
    };

    storage::set_farmer(env, &profile);
    storage::extend_instance_ttl(env);

    events::farmer_registered(env, farmer, name);
}

/// Updates name/location for an already-registered farmer.
/// Only the farmer themselves may call this (`farmer.require_auth()`).
/// Preserves `registration_time` from the original profile.
pub fn update_farmer_profile(
    env: &Env,
    farmer: Address,
    name: String,
    location: String,
) {
    farmer.require_auth();

    let existing = storage::get_farmer(env, &farmer)
        .unwrap_or_else(|| panic!("farmer not registered"));

    let profile = FarmerProfile {
        address: farmer.clone(),
        name: name.clone(),
        location: location.clone(),
        registration_time: existing.registration_time,
    };

    storage::set_farmer(env, &profile);
    storage::extend_instance_ttl(env);

    events::farmer_updated(env, farmer, name, location);
}

pub fn get_farmer(env: &Env, farmer: &Address) -> Option<FarmerProfile> {
    storage::get_farmer(env, farmer)
}
