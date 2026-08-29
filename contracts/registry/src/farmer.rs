use crate::types::FarmerProfile;
use crate::{events, storage};
use soroban_sdk::{Address, Env, String};

pub fn register_farmer(env: &Env, farmer: Address, name: String, location: String) {
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

pub fn get_farmer(env: &Env, farmer: &Address) -> Option<FarmerProfile> {
    storage::get_farmer(env, farmer)
}
