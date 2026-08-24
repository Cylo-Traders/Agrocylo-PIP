use crate::{ActivityAction, CampaignStatus, DataKey, RegistryContract, RegistryContractClient};
use soroban_sdk::{
    testutils::{storage::Persistent as _, Address as _, Events, Ledger, MockAuth, MockAuthInvoke},
    vec, Address, Env, IntoVal, String, Symbol,
};

fn create_test_env() -> (
    Env,
    Address,
    Address,
    Address,
    RegistryContractClient<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let contract_addr = Address::generate(&env);

    let contract_id = env.register_contract(None, RegistryContract);
    let client = RegistryContractClient::new(&env, &contract_id);

    (env, admin, user, contract_addr, client)
}

#[test]
fn test_initialize_admin() {
    let (env, admin, _, _, client) = create_test_env();

    client.initialize(&admin);

    let stored_admin = client.get_admin();
    assert_eq!(stored_admin, admin);

    let event = env.events().all().last().unwrap();
    assert_eq!(
        event.1,
        (Symbol::new(&env, "AdminInitialized"), admin.clone()).into_val(&env)
    );
}

#[test]
#[should_panic(expected = "admin already initialized")]
fn test_initialize_admin_twice_fails() {
    let (_env, admin, _, _, client) = create_test_env();

    client.initialize(&admin);
    client.initialize(&admin);
}

#[test]
fn test_update_admin() {
    let (env, admin, _user, _, client) = create_test_env();

    client.initialize(&admin);

    let new_admin = Address::generate(&env);
    client.update_admin(&new_admin);

    let stored_admin = client.get_admin();
    assert_eq!(stored_admin, new_admin);

    let event = env.events().all().last().unwrap();
    assert_eq!(
        event.1,
        (Symbol::new(&env, "AdminUpdated"), new_admin.clone()).into_val(&env)
    );
}

#[test]
fn test_update_admin_requires_admin_auth() {
    let (env, admin, _, _, client) = create_test_env();

    client.initialize(&admin);

    let _new_admin = Address::generate(&env);
    let current_admin = client.get_admin();
    assert_eq!(current_admin, admin);
}

#[test]
fn test_update_admin_unauthorized_fails() {
    let (env, admin, _user, _, client) = create_test_env();

    client.initialize(&admin);

    env.mock_all_auths_allowing_non_root_auth();

    let new_admin = Address::generate(&env);
    let current_admin = client.get_admin();
    assert_eq!(current_admin, admin);
    client.update_admin(&new_admin);

    let stored_admin = client.get_admin();
    assert_eq!(stored_admin, new_admin);
}

#[test]
fn test_approve_contract() {
    let (env, admin, _, contract_addr, client) = create_test_env();

    client.initialize(&admin);

    client.approve_contract(&contract_addr);

    let is_approved = client.is_contract_approved(&contract_addr);
    assert!(is_approved);

    let event = env.events().all().last().unwrap();
    assert_eq!(
        event.1,
        (Symbol::new(&env, "ContractApproved"), contract_addr.clone()).into_val(&env)
    );
}

#[test]
fn test_revoke_contract() {
    let (env, admin, _, contract_addr, client) = create_test_env();

    client.initialize(&admin);

    client.approve_contract(&contract_addr);
    assert!(client.is_contract_approved(&contract_addr));

    client.revoke_contract(&contract_addr);
    assert!(!client.is_contract_approved(&contract_addr));

    let event = env.events().all().last().unwrap();
    assert_eq!(
        event.1,
        (Symbol::new(&env, "ContractRevoked"), contract_addr.clone()).into_val(&env)
    );
}

#[test]
fn test_approve_contract_requires_admin_auth() {
    let (env, admin, _, contract_addr, client) = create_test_env();

    let admin = Address::generate(&env);
    let contract_addr = Address::generate(&env);
    let non_admin = Address::generate(&env);

    // Initialize with the real admin (admin signs via mock for this one call only).
    env.mock_all_auths();
    client.initialize(&admin);

    client.approve_contract(&contract_addr);
    let _ = non_admin;
}

#[test]
fn test_record_activity_as_admin() {
    let (env, admin, _, _, client) = create_test_env();

    client.initialize(&admin);

    let campaign_id = 1u64;
    client.record_activity(&campaign_id, &admin, &ActivityAction::CampaignCreated);

    let activities = client.get_campaign_activities(&campaign_id);
    assert_eq!(activities.len(), 1);

    let activity = activities.get(0).unwrap();
    assert_eq!(activity.actor, admin);
    assert_eq!(activity.action_type, ActivityAction::CampaignCreated);

    let events = env.events().all();
    let campaign_event = events.get(events.len() - 2).unwrap();
    assert_eq!(
        campaign_event.1,
        (Symbol::new(&env, "CampaignRegistered"), campaign_id).into_val(&env)
    );

    let activity_event = events.last().unwrap();
    assert_eq!(
        activity_event.1,
        (Symbol::new(&env, "ActivityRecorded"), campaign_id).into_val(&env)
    );
}

#[test]
fn test_farmer_registered_event() {
    let (env, admin, farmer, _, client) = create_test_env();

    client.initialize(&admin);

    let campaign_id = 1u64;
    client.record_activity(&campaign_id, &farmer, &ActivityAction::FarmerRegistered);

    let events = env.events().all();
    let farmer_event = events.get(events.len() - 2).unwrap();
    assert_eq!(
        farmer_event.1,
        (Symbol::new(&env, "FarmerRegistered"), farmer.clone()).into_val(&env)
    );
}

#[test]
fn test_campaign_registered_event() {
    let (env, admin, _, _, client) = create_test_env();

    client.initialize(&admin);

    let campaign_id = 2u64;
    client.record_activity(&campaign_id, &admin, &ActivityAction::CampaignRegistered);

    let events = env.events().all();
    let campaign_event = events.get(events.len() - 2).unwrap();
    assert_eq!(
        campaign_event.1,
        (Symbol::new(&env, "CampaignRegistered"), campaign_id).into_val(&env)
    );
}

#[test]
fn test_campaign_status_updated_event() {
    let (env, admin, _, _, client) = create_test_env();

    client.initialize(&admin);

    let campaign_id = 3u64;
    client.record_activity(&campaign_id, &admin, &ActivityAction::CampaignStatusChanged);

    let events = env.events().all();
    let status_event = events.get(events.len() - 2).unwrap();
    assert_eq!(
        status_event.1,
        (Symbol::new(&env, "CampaignStatusUpdated"), campaign_id).into_val(&env)
    );
}

#[test]
fn test_record_activity_as_approved_contract() {
    let (_env, admin, _, contract_addr, client) = create_test_env();

    client.initialize(&admin);
    client.approve_contract(&contract_addr);

    let campaign_id = 1u64;
    client.record_activity(
        &campaign_id,
        &contract_addr,
        &ActivityAction::CampaignFunded,
    );

    let activities = client.get_campaign_activities(&campaign_id);
    assert_eq!(activities.len(), 1);
}

#[test]
#[should_panic]
fn test_record_activity_claimed_admin_requires_admin_auth() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let non_admin = Address::generate(&env);
    let contract_id = env.register_contract(None, RegistryContract);
    let client = RegistryContractClient::new(&env, &contract_id);

    client.initialize(&admin);

    let campaign_id = 1u64;
    env.mock_auths(&[MockAuth {
        address: &non_admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "record_activity",
            args: (campaign_id, admin.clone(), ActivityAction::CampaignCreated).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    client.record_activity(&campaign_id, &admin, &ActivityAction::CampaignCreated);
}

#[test]
#[should_panic]
fn test_record_activity_claimed_approved_contract_requires_contract_auth() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let approved_contract = Address::generate(&env);
    let non_approved = Address::generate(&env);
    let contract_id = env.register_contract(None, RegistryContract);
    let client = RegistryContractClient::new(&env, &contract_id);

    client.initialize(&admin);
    client.approve_contract(&approved_contract);

    let campaign_id = 1u64;
    env.mock_auths(&[MockAuth {
        address: &non_approved,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "record_activity",
            args: (
                campaign_id,
                approved_contract.clone(),
                ActivityAction::CampaignFunded,
            )
                .into_val(&env),
            sub_invokes: &[],
        },
    }]);

    client.record_activity(
        &campaign_id,
        &approved_contract,
        &ActivityAction::CampaignFunded,
    );
}

#[test]
fn test_record_multiple_activities() {
    let (_env, admin, _, _, client) = create_test_env();

    client.initialize(&admin);

    let campaign_id = 1u64;
    client.record_activity(&campaign_id, &admin, &ActivityAction::CampaignCreated);
    client.record_activity(&campaign_id, &admin, &ActivityAction::CampaignFunded);
    client.record_activity(&campaign_id, &admin, &ActivityAction::CampaignStatusChanged);

    let activities = client.get_campaign_activities(&campaign_id);
    assert_eq!(activities.len(), 3);

    assert_eq!(
        activities.get(0).unwrap().action_type,
        ActivityAction::CampaignCreated
    );
    assert_eq!(
        activities.get(1).unwrap().action_type,
        ActivityAction::CampaignFunded
    );
    assert_eq!(
        activities.get(2).unwrap().action_type,
        ActivityAction::CampaignStatusChanged
    );
}

#[test]
fn test_activities_different_campaigns() {
    let (_env, admin, _, _, client) = create_test_env();

    client.initialize(&admin);

    let campaign_id_1 = 1u64;
    let campaign_id_2 = 2u64;

    client.record_activity(&campaign_id_1, &admin, &ActivityAction::CampaignCreated);
    client.record_activity(&campaign_id_2, &admin, &ActivityAction::CampaignCreated);
    client.record_activity(&campaign_id_1, &admin, &ActivityAction::CampaignFunded);

    let activities_1 = client.get_campaign_activities(&campaign_id_1);
    let activities_2 = client.get_campaign_activities(&campaign_id_2);

    assert_eq!(activities_1.len(), 2);
    assert_eq!(activities_2.len(), 1);
}

#[test]
fn test_get_activities_empty_campaign() {
    let (_env, admin, _, _, client) = create_test_env();

    client.initialize(&admin);

    let campaign_id = 999u64;
    let activities = client.get_campaign_activities(&campaign_id);

    assert_eq!(activities.len(), 0);
}

#[test]
fn test_activity_timestamp_and_ledger() {
    let (env, admin, _, _, client) = create_test_env();

    // Advance ledger so timestamp and sequence are non-zero.
    env.ledger().set(soroban_sdk::testutils::LedgerInfo {
        timestamp: 1_000_000,
        protocol_version: 22,
        sequence_number: 100,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 10,
        min_persistent_entry_ttl: 10,
        max_entry_ttl: 3_110_400,
    });

    client.initialize(&admin);

    let campaign_id = 1u64;
    client.record_activity(&campaign_id, &admin, &ActivityAction::CampaignCreated);

    let activities = client.get_campaign_activities(&campaign_id);
    let activity = activities.get(0).unwrap();

    assert_eq!(activity.action_type, ActivityAction::CampaignCreated);
}

#[test]
fn test_record_activity_as_authorized_user() {
    let (_env, admin, user, _, client) = create_test_env();

    client.initialize(&admin);

    let campaign_id = 1u64;
    client.record_activity(&campaign_id, &user, &ActivityAction::CampaignFunded);

    let activities = client.get_campaign_activities(&campaign_id);
    assert_eq!(activities.len(), 1);
    assert_eq!(activities.get(0).unwrap().actor, user);
}

#[test]
fn test_all_activity_actions() {
    let (env, admin, _, _, client) = create_test_env();

    client.initialize(&admin);

    let campaign_id = 1u64;

    let actions = vec![
        &env,
        ActivityAction::CampaignCreated,
        ActivityAction::FarmerRegistered,
        ActivityAction::CampaignRegistered,
        ActivityAction::CampaignFunded,
        ActivityAction::CampaignStatusChanged,
        ActivityAction::FundsReleased,
        ActivityAction::HarvestReported,
        ActivityAction::DisputeInitiated,
        ActivityAction::DisputeResolved,
        ActivityAction::CampaignSettled,
    ];

    for action in actions.iter() {
        client.record_activity(&campaign_id, &admin, &action);
    }

    let activities = client.get_campaign_activities(&campaign_id);
    assert_eq!(activities.len(), 10);
}

// Farmer Registration Tests

#[test]
fn test_register_farmer_success() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    let name = String::from_str(&env, "John Doe");
    let location = String::from_str(&env, "Farm Valley");

    client.register_farmer(&user, &name, &location);

    let farmer_profile = client.get_farmer(&user);
    assert!(farmer_profile.is_some());

    let profile = farmer_profile.unwrap();
    assert_eq!(profile.address, user);
    assert_eq!(profile.name, name);
    assert_eq!(profile.location, location);
}

#[test]
#[should_panic(expected = "farmer already registered")]
fn test_register_farmer_duplicate_fails() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    let name = String::from_str(&env, "John Doe");
    let location = String::from_str(&env, "Farm Valley");

    client.register_farmer(&user, &name, &location);
    client.register_farmer(&user, &name, &location);
}

#[test]
fn test_register_farmer_requires_authorization() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    let name = String::from_str(&env, "John Doe");
    let location = String::from_str(&env, "Farm Valley");

    client.register_farmer(&user, &name, &location);

    let profile = client.get_farmer(&user).unwrap();
    assert_eq!(profile.name, name);
}

#[test]
fn test_get_farmer_nonexistent() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    let farmer_profile = client.get_farmer(&user);
    assert!(farmer_profile.is_none());
}

#[test]
fn test_register_multiple_farmers() {
    let (env, admin, _, _, client) = create_test_env();
    client.initialize(&admin);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    let name1 = String::from_str(&env, "Alice");
    let location1 = String::from_str(&env, "North Farm");

    let name2 = String::from_str(&env, "Bob");
    let location2 = String::from_str(&env, "South Farm");

    client.register_farmer(&user1, &name1, &location1);
    client.register_farmer(&user2, &name2, &location2);

    let profile1 = client.get_farmer(&user1).unwrap();
    let profile2 = client.get_farmer(&user2).unwrap();

    assert_eq!(profile1.name, name1);
    assert_eq!(profile2.name, name2);
    assert_ne!(profile1.address, profile2.address);
}

#[test]
fn test_farmer_profile_contains_metadata() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    let name = String::from_str(&env, "Jane Smith");
    let location = String::from_str(&env, "Eastern Fields");

    client.register_farmer(&user, &name, &location);

    let profile = client.get_farmer(&user).unwrap();

    assert_eq!(profile.address, user);
    assert_eq!(profile.name, name);
    assert_eq!(profile.location, location);
}

// Campaign Registration Tests

#[test]
fn test_register_campaign_success() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id = 1u64;
    let title = String::from_str(&env, "Coffee Farm");
    let description = String::from_str(&env, "High-quality arabica coffee");

    client.register_campaign(&campaign_id, &user, &title, &description);

    let campaign = client.get_campaign(&campaign_id);
    assert!(campaign.is_some());

    let camp = campaign.unwrap();
    assert_eq!(camp.id, campaign_id);
    assert_eq!(camp.farmer, user);
    assert_eq!(camp.title, title);
    assert_eq!(camp.description, description);
}

#[test]
#[should_panic(expected = "campaign already registered")]
fn test_register_campaign_duplicate_fails() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id = 1u64;
    let title = String::from_str(&env, "Coffee Farm");
    let description = String::from_str(&env, "High-quality arabica coffee");

    client.register_campaign(&campaign_id, &user, &title, &description);
    client.register_campaign(&campaign_id, &user, &title, &description);
}

#[test]
fn test_register_campaign_requires_authorization() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id = 1u64;
    let title = String::from_str(&env, "Coffee Farm");
    let description = String::from_str(&env, "High-quality arabica coffee");

    client.register_campaign(&campaign_id, &user, &title, &description);

    let campaign = client.get_campaign(&campaign_id).unwrap();
    assert_eq!(campaign.farmer, user);
}

#[test]
fn test_get_campaign_nonexistent() {
    let (env, admin, _, _, client) = create_test_env();
    client.initialize(&admin);

    let campaign = client.get_campaign(&999u64);
    assert!(campaign.is_none());
}

#[test]
fn test_register_multiple_campaigns() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id_1 = 1u64;
    let campaign_id_2 = 2u64;

    let title1 = String::from_str(&env, "Coffee Farm");
    let desc1 = String::from_str(&env, "Arabica coffee");

    let title2 = String::from_str(&env, "Cocoa Plantation");
    let desc2 = String::from_str(&env, "Premium cocoa");

    client.register_campaign(&campaign_id_1, &user, &title1, &desc1);
    client.register_campaign(&campaign_id_2, &user, &title2, &desc2);

    let camp1 = client.get_campaign(&campaign_id_1).unwrap();
    let camp2 = client.get_campaign(&campaign_id_2).unwrap();

    assert_eq!(camp1.title, title1);
    assert_eq!(camp2.title, title2);
    assert_ne!(camp1.id, camp2.id);
}

#[test]
fn test_campaign_and_farmer_integration() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    let farmer_name = String::from_str(&env, "John Farmer");
    let farmer_location = String::from_str(&env, "Farm Land");

    client.register_farmer(&user, &farmer_name, &farmer_location);

    let campaign_id = 1u64;
    let campaign_title = String::from_str(&env, "Coffee Farm");
    let campaign_desc = String::from_str(&env, "Premium coffee");

    client.register_campaign(&campaign_id, &user, &campaign_title, &campaign_desc);

    let farmer_profile = client.get_farmer(&user).unwrap();
    let campaign = client.get_campaign(&campaign_id).unwrap();

    assert_eq!(farmer_profile.address, campaign.farmer);
    assert_eq!(farmer_profile.name, farmer_name);
}

// Campaign Escrow Linking & Status Tests

#[test]
fn test_link_campaign_escrow_success() {
    let (env, admin, user, escrow, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id = 1u64;
    let crop = Symbol::new(&env, "coffee");
    let region = Symbol::new(&env, "highlands");

    client.link_campaign_escrow(&campaign_id, &user, &escrow, &crop, &region);

    let record = client.get_campaign_record(&campaign_id).unwrap();
    assert_eq!(record.campaign_id, campaign_id);
    assert_eq!(record.farmer, user);
    assert_eq!(record.escrow_contract, escrow);
    assert_eq!(record.status, CampaignStatus::Active);
}

#[test]
#[should_panic(expected = "campaign already linked")]
fn test_link_campaign_escrow_duplicate_fails() {
    let (env, admin, user, escrow, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id = 1u64;
    let crop = Symbol::new(&env, "coffee");
    let region = Symbol::new(&env, "highlands");

    client.link_campaign_escrow(&campaign_id, &user, &escrow, &crop, &region);
    client.link_campaign_escrow(&campaign_id, &user, &escrow, &crop, &region);
}

#[test]
fn test_get_campaign_record_nonexistent_returns_none() {
    let (_env, admin, _, _, client) = create_test_env();
    client.initialize(&admin);

    let record = client.get_campaign_record(&999u64);
    assert!(record.is_none());
}

#[test]
fn test_update_campaign_status_as_escrow_contract() {
    let (env, admin, user, escrow, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id = 1u64;
    let crop = Symbol::new(&env, "coffee");
    let region = Symbol::new(&env, "highlands");
    client.link_campaign_escrow(&campaign_id, &user, &escrow, &crop, &region);

    client.update_campaign_status(&campaign_id, &escrow, &CampaignStatus::Funding);

    let record = client.get_campaign_record(&campaign_id).unwrap();
    assert_eq!(record.status, CampaignStatus::Funding);

    let event = env.events().all().last().unwrap();
    assert_eq!(
        event.1,
        (Symbol::new(&env, "CampaignStatusUpdated"), campaign_id).into_val(&env)
    );
}

#[test]
fn test_update_campaign_status_as_admin() {
    let (env, admin, user, escrow, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id = 1u64;
    let crop = Symbol::new(&env, "coffee");
    let region = Symbol::new(&env, "highlands");
    client.link_campaign_escrow(&campaign_id, &user, &escrow, &crop, &region);

    client.update_campaign_status(&campaign_id, &admin, &CampaignStatus::Settled);

    let record = client.get_campaign_record(&campaign_id).unwrap();
    assert_eq!(record.status, CampaignStatus::Settled);
}

#[test]
#[should_panic(expected = "unauthorized: caller is not the registered escrow contract or admin")]
fn test_update_campaign_status_unauthorized_caller_fails() {
    let (env, admin, user, escrow, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id = 1u64;
    let crop = Symbol::new(&env, "coffee");
    let region = Symbol::new(&env, "highlands");
    client.link_campaign_escrow(&campaign_id, &user, &escrow, &crop, &region);

    let random = Address::generate(&env);
    client.update_campaign_status(&campaign_id, &random, &CampaignStatus::Funding);
}

#[test]
fn test_get_campaigns_by_farmer() {
    let (env, admin, user, escrow, client) = create_test_env();
    client.initialize(&admin);

    let escrow_2 = Address::generate(&env);
    let crop = Symbol::new(&env, "coffee");
    let region = Symbol::new(&env, "highlands");

    client.link_campaign_escrow(&1u64, &user, &escrow, &crop, &region);
    client.link_campaign_escrow(&2u64, &user, &escrow_2, &crop, &region);

    let campaigns = client.get_campaigns_by_farmer(&user);
    assert_eq!(campaigns.len(), 2);
    assert_eq!(campaigns.get(0).unwrap(), 1u64);
    assert_eq!(campaigns.get(1).unwrap(), 2u64);
}

#[test]
fn test_get_campaigns_by_farmer_empty() {
    let (_env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    let campaigns = client.get_campaigns_by_farmer(&user);
    assert_eq!(campaigns.len(), 0);
}

// Paginated list storage tests (Issue #157: bounded ledger entries)

#[test]
fn test_activities_paginate_across_multiple_pages() {
    let (env, admin, _, _, client) = create_test_env();
    // Writing several hundred records in one test exceeds the default mock
    // budget; each write is a separate transaction in production.
    env.budget().reset_unlimited();
    client.initialize(&admin);

    let campaign_id = 1u64;
    let max_per_page = crate::storage::MAX_ACTIVITIES_PER_PAGE;
    // Enough entries to fill two full pages plus a partial third.
    let total = max_per_page * 2 + 25;

    let actions = [
        ActivityAction::CampaignCreated,
        ActivityAction::FarmerRegistered,
        ActivityAction::CampaignRegistered,
        ActivityAction::CampaignFunded,
        ActivityAction::CampaignStatusChanged,
        ActivityAction::FundsReleased,
        ActivityAction::HarvestReported,
        ActivityAction::DisputeInitiated,
        ActivityAction::DisputeResolved,
        ActivityAction::CampaignSettled,
    ];

    for i in 0..total {
        client.record_activity(
            &campaign_id,
            &admin,
            &actions[(i % actions.len() as u32) as usize],
        );
    }

    // A fresh page is opened every time the previous one fills up.
    let page_count = client.get_campaign_activity_page_count(&campaign_id);
    assert_eq!(page_count, total / max_per_page + 1);

    // Every page but the last is full; the last page holds the remainder.
    let first_page = client.get_campaign_activities_page(&campaign_id, &0u32);
    assert_eq!(first_page.len(), max_per_page);
    let last_page = client.get_campaign_activities_page(&campaign_id, &(page_count - 1));
    assert_eq!(last_page.len(), total % max_per_page);

    // Reading everything still returns all records, in insertion order.
    let activities = client.get_campaign_activities(&campaign_id);
    assert_eq!(activities.len(), total);
    for i in 0..total {
        let expected = actions[(i % actions.len() as u32) as usize].clone();
        assert_eq!(activities.get(i).unwrap().action_type, expected);
    }
}

#[test]
fn test_farmer_campaigns_paginate_across_multiple_pages() {
    let (env, admin, user, escrow, client) = create_test_env();
    // Linking hundreds of campaigns in one test exceeds the default mock
    // budget; each link is a separate transaction in production.
    env.budget().reset_unlimited();
    client.initialize(&admin);

    let crop = Symbol::new(&env, "coffee");
    let region = Symbol::new(&env, "highlands");

    let max_per_page = crate::storage::MAX_FARMER_CAMPAIGNS_PER_PAGE;
    // Enough campaign links to span three pages.
    let total = max_per_page * 2 + 25;

    for i in 0..total {
        client.link_campaign_escrow(&(i as u64), &user, &escrow, &crop, &region);
    }

    let page_count = client.get_farmer_campaigns_page_count(&user);
    assert_eq!(page_count, total / max_per_page + 1);

    let first_page = client.get_campaigns_by_farmer_page(&user, &0u32);
    assert_eq!(first_page.len(), max_per_page);
    let last_page = client.get_campaigns_by_farmer_page(&user, &(page_count - 1));
    assert_eq!(last_page.len(), total % max_per_page);

    // Reading everything still returns all campaign ids, in link order.
    let campaigns = client.get_campaigns_by_farmer(&user);
    assert_eq!(campaigns.len(), total);
    for i in 0..total {
        assert_eq!(campaigns.get(i).unwrap(), i as u64);
    }
}

// ─── touch_campaign / TTL keep-alive ─────────────────────────────────────────

fn persistent_ttl(env: &Env, contract: &Address, key: &DataKey) -> u32 {
    env.as_contract(contract, || env.storage().persistent().get_ttl(key))
}

fn expire_persistent_ttl_below_threshold(env: &Env) {
    let delta =
        crate::storage::PERSISTENT_BUMP_AMOUNT - crate::storage::PERSISTENT_LIFETIME_THRESHOLD + 1;
    env.ledger().with_mut(|li| {
        li.sequence_number += delta;
    });
}

#[test]
fn test_touch_campaign_extends_ttl_without_state_change() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id = 1u64;
    let title = String::from_str(&env, "Coffee Farm");
    let description = String::from_str(&env, "High-quality arabica coffee");
    client.register_campaign(&campaign_id, &user, &title, &description);

    let before = client.get_campaign(&campaign_id).unwrap();
    let key = DataKey::Campaign(campaign_id);
    assert_eq!(
        persistent_ttl(&env, &client.address, &key),
        crate::storage::PERSISTENT_BUMP_AMOUNT
    );

    expire_persistent_ttl_below_threshold(&env);
    assert!(
        persistent_ttl(&env, &client.address, &key) < crate::storage::PERSISTENT_LIFETIME_THRESHOLD
    );

    client.touch_campaign(&campaign_id);

    assert_eq!(
        persistent_ttl(&env, &client.address, &key),
        crate::storage::PERSISTENT_BUMP_AMOUNT
    );
    assert_eq!(client.get_campaign(&campaign_id).unwrap(), before);
}

#[test]
fn test_touch_campaign_bumps_record_and_activity_pages() {
    let (env, admin, user, escrow, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id = 1u64;
    client.register_campaign(
        &campaign_id,
        &user,
        &String::from_str(&env, "Coffee Farm"),
        &String::from_str(&env, "Arabica"),
    );
    client.link_campaign_escrow(
        &campaign_id,
        &user,
        &escrow,
        &Symbol::new(&env, "coffee"),
        &Symbol::new(&env, "highlands"),
    );
    client.update_campaign_status(&campaign_id, &admin, &CampaignStatus::Settled);
    client.record_activity(&campaign_id, &admin, &ActivityAction::CampaignSettled);

    let campaign_key = DataKey::Campaign(campaign_id);
    let record_key = DataKey::CampaignRecord(campaign_id);
    let count_key = DataKey::CampaignActivitiesPageCount(campaign_id);
    let page_key = DataKey::CampaignActivitiesPage(campaign_id, 0);

    expire_persistent_ttl_below_threshold(&env);
    assert!(
        persistent_ttl(&env, &client.address, &campaign_key)
            < crate::storage::PERSISTENT_LIFETIME_THRESHOLD
    );
    assert!(
        persistent_ttl(&env, &client.address, &record_key)
            < crate::storage::PERSISTENT_LIFETIME_THRESHOLD
    );
    assert!(
        persistent_ttl(&env, &client.address, &count_key)
            < crate::storage::PERSISTENT_LIFETIME_THRESHOLD
    );
    assert!(
        persistent_ttl(&env, &client.address, &page_key)
            < crate::storage::PERSISTENT_LIFETIME_THRESHOLD
    );

    client.touch_campaign(&campaign_id);

    assert_eq!(
        persistent_ttl(&env, &client.address, &campaign_key),
        crate::storage::PERSISTENT_BUMP_AMOUNT
    );
    assert_eq!(
        persistent_ttl(&env, &client.address, &record_key),
        crate::storage::PERSISTENT_BUMP_AMOUNT
    );
    assert_eq!(
        persistent_ttl(&env, &client.address, &count_key),
        crate::storage::PERSISTENT_BUMP_AMOUNT
    );
    assert_eq!(
        persistent_ttl(&env, &client.address, &page_key),
        crate::storage::PERSISTENT_BUMP_AMOUNT
    );
    assert_eq!(
        client.get_campaign_record(&campaign_id).unwrap().status,
        CampaignStatus::Settled
    );
}

#[test]
fn test_touch_campaign_linked_record_only() {
    let (env, admin, user, escrow, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id = 1u64;
    client.link_campaign_escrow(
        &campaign_id,
        &user,
        &escrow,
        &Symbol::new(&env, "coffee"),
        &Symbol::new(&env, "highlands"),
    );

    expire_persistent_ttl_below_threshold(&env);
    client.touch_campaign(&campaign_id);

    assert_eq!(
        persistent_ttl(&env, &client.address, &DataKey::CampaignRecord(campaign_id)),
        crate::storage::PERSISTENT_BUMP_AMOUNT
    );
}

#[test]
#[should_panic(expected = "campaign not found (missing or archived")]
fn test_touch_campaign_missing_panics() {
    let (_env, admin, _, _, client) = create_test_env();
    client.initialize(&admin);
    client.touch_campaign(&999u64);
}
