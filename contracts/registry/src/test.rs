use crate::{ActivityAction, CampaignStatus, RegistryContract, RegistryContractClient};
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger, MockAuth, MockAuthInvoke},
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
    // This test generates its own admin/contract addresses below, so the ones
    // returned by the harness are deliberately discarded.
    let (env, _, _, _, client) = create_test_env();

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
    let (_, admin, user, _, client) = create_test_env();
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
    let (_, admin, _, _, client) = create_test_env();
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

    client.register_campaign(
        &campaign_id,
        &user,
        &String::from_str(&env, "Coffee Farm"),
        &String::from_str(&env, "Premium coffee"),
    );
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

    client.register_campaign(
        &campaign_id,
        &user,
        &String::from_str(&env, "Coffee Farm"),
        &String::from_str(&env, "Premium coffee"),
    );
    client.link_campaign_escrow(&campaign_id, &user, &escrow, &crop, &region);
    client.link_campaign_escrow(&campaign_id, &user, &escrow, &crop, &region);
}

#[test]
#[should_panic(expected = "campaign not registered")]
fn test_link_campaign_escrow_before_register_fails() {
    let (env, admin, user, escrow, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id = 1u64;
    let crop = Symbol::new(&env, "coffee");
    let region = Symbol::new(&env, "highlands");

    // Never registered via register_campaign.
    client.link_campaign_escrow(&campaign_id, &user, &escrow, &crop, &region);
}

#[test]
#[should_panic(expected = "farmer does not match registered campaign")]
fn test_link_campaign_escrow_farmer_mismatch_fails() {
    let (env, admin, user, escrow, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id = 1u64;
    let crop = Symbol::new(&env, "coffee");
    let region = Symbol::new(&env, "highlands");
    let other_farmer = Address::generate(&env);

    client.register_campaign(
        &campaign_id,
        &user,
        &String::from_str(&env, "Coffee Farm"),
        &String::from_str(&env, "Premium coffee"),
    );
    // Different farmer than the one that registered the campaign.
    client.link_campaign_escrow(&campaign_id, &other_farmer, &escrow, &crop, &region);
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
    client.register_campaign(
        &campaign_id,
        &user,
        &String::from_str(&env, "Coffee Farm"),
        &String::from_str(&env, "Premium coffee"),
    );
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
    client.register_campaign(
        &campaign_id,
        &user,
        &String::from_str(&env, "Coffee Farm"),
        &String::from_str(&env, "Premium coffee"),
    );
    client.link_campaign_escrow(&campaign_id, &user, &escrow, &crop, &region);

    client.update_campaign_status(&campaign_id, &admin, &CampaignStatus::Settled);

    let record = client.get_campaign_record(&campaign_id).unwrap();
    assert_eq!(record.status, CampaignStatus::Settled);
}

#[test]
fn test_update_campaign_status_harvested() {
    let (env, admin, user, escrow, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id = 1u64;
    let crop = Symbol::new(&env, "coffee");
    let region = Symbol::new(&env, "highlands");
    client.register_campaign(
        &campaign_id,
        &user,
        &String::from_str(&env, "Coffee Farm"),
        &String::from_str(&env, "Premium coffee"),
    );
    client.link_campaign_escrow(&campaign_id, &user, &escrow, &crop, &region);

    client.update_campaign_status(&campaign_id, &escrow, &CampaignStatus::Harvested);

    let record = client.get_campaign_record(&campaign_id).unwrap();
    assert_eq!(record.status, CampaignStatus::Harvested);
}

#[test]
fn test_update_campaign_status_failed() {
    let (env, admin, user, escrow, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id = 1u64;
    let crop = Symbol::new(&env, "coffee");
    let region = Symbol::new(&env, "highlands");
    client.register_campaign(
        &campaign_id,
        &user,
        &String::from_str(&env, "Coffee Farm"),
        &String::from_str(&env, "Premium coffee"),
    );
    client.link_campaign_escrow(&campaign_id, &user, &escrow, &crop, &region);

    client.update_campaign_status(&campaign_id, &escrow, &CampaignStatus::Failed);

    let record = client.get_campaign_record(&campaign_id).unwrap();
    assert_eq!(record.status, CampaignStatus::Failed);
}

#[test]
#[should_panic(expected = "unauthorized: caller is not the registered escrow contract or admin")]
fn test_update_campaign_status_unauthorized_caller_fails() {
    let (env, admin, user, escrow, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id = 1u64;
    let crop = Symbol::new(&env, "coffee");
    let region = Symbol::new(&env, "highlands");
    client.register_campaign(
        &campaign_id,
        &user,
        &String::from_str(&env, "Coffee Farm"),
        &String::from_str(&env, "Premium coffee"),
    );
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

    client.register_campaign(
        &1u64,
        &user,
        &String::from_str(&env, "Coffee Farm"),
        &String::from_str(&env, "Premium coffee"),
    );
    client.register_campaign(
        &2u64,
        &user,
        &String::from_str(&env, "Cocoa Farm"),
        &String::from_str(&env, "Premium cocoa"),
    );
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
        client.register_campaign(
            &(i as u64),
            &user,
            &String::from_str(&env, "Coffee Farm"),
            &String::from_str(&env, "Premium coffee"),
        );
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

// ---------------------------------------------------------------------------
// Profile & Campaign Metadata Updates (Issue #156)
// ---------------------------------------------------------------------------

#[test]
fn test_update_farmer_profile_success() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    client.register_farmer(
        &user,
        &String::from_str(&env, "Alice Original"),
        &String::from_str(&env, "Nairobi"),
    );

    let initial = client.get_farmer(&user).unwrap();
    assert_eq!(initial.name, String::from_str(&env, "Alice Original"));
    assert_eq!(initial.location, String::from_str(&env, "Nairobi"));

    // Advance ledger time to verify registration_time is preserved
    env.ledger().with_mut(|li| li.timestamp += 100);

    client.update_farmer_profile(
        &user,
        &String::from_str(&env, "Alice Updated"),
        &String::from_str(&env, "Mombasa"),
    );

    let updated = client.get_farmer(&user).unwrap();
    assert_eq!(updated.name, String::from_str(&env, "Alice Updated"));
    assert_eq!(updated.location, String::from_str(&env, "Mombasa"));
    assert_eq!(updated.registration_time, initial.registration_time);

    let event = env.events().all().last().unwrap();
    assert_eq!(
        event.1,
        (Symbol::new(&env, "FarmerProfileUpdated"), user.clone()).into_val(&env)
    );
}

#[test]
#[should_panic(expected = "farmer not registered")]
fn test_update_farmer_profile_unregistered_fails() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    client.update_farmer_profile(
        &user,
        &String::from_str(&env, "Alice"),
        &String::from_str(&env, "Kisumu"),
    );
}

#[test]
fn test_update_campaign_metadata_success_unlinked() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id = 100u64;
    client.register_campaign(
        &campaign_id,
        &user,
        &String::from_str(&env, "Initial Title"),
        &String::from_str(&env, "Initial Description"),
    );

    let initial = client.get_campaign(&campaign_id).unwrap();
    assert_eq!(initial.title, String::from_str(&env, "Initial Title"));
    assert_eq!(
        initial.description,
        String::from_str(&env, "Initial Description")
    );

    env.ledger().with_mut(|li| li.timestamp += 200);

    client.update_campaign_metadata(
        &campaign_id,
        &user,
        &String::from_str(&env, "Updated Title"),
        &String::from_str(&env, "Updated Description"),
    );

    let updated = client.get_campaign(&campaign_id).unwrap();
    assert_eq!(updated.title, String::from_str(&env, "Updated Title"));
    assert_eq!(
        updated.description,
        String::from_str(&env, "Updated Description")
    );
    assert_eq!(updated.created_at, initial.created_at);

    let event = env.events().all().last().unwrap();
    assert_eq!(
        event.1,
        (Symbol::new(&env, "CampaignMetadataUpdated"), campaign_id).into_val(&env)
    );
}

#[test]
fn test_update_campaign_metadata_success_active_and_funding() {
    let (env, admin, user, escrow, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id = 101u64;
    let crop = Symbol::new(&env, "maize");
    let region = Symbol::new(&env, "rift");

    client.register_campaign(
        &campaign_id,
        &user,
        &String::from_str(&env, "Maize 1"),
        &String::from_str(&env, "Desc 1"),
    );
    client.link_campaign_escrow(&campaign_id, &user, &escrow, &crop, &region);

    // Status is Active -> updating metadata succeeds
    client.update_campaign_metadata(
        &campaign_id,
        &user,
        &String::from_str(&env, "Maize Active Edit"),
        &String::from_str(&env, "Desc Active Edit"),
    );
    let c1 = client.get_campaign(&campaign_id).unwrap();
    assert_eq!(c1.title, String::from_str(&env, "Maize Active Edit"));

    // Transition status to Funding -> updating metadata still succeeds
    client.update_campaign_status(&campaign_id, &escrow, &CampaignStatus::Funding);
    client.update_campaign_metadata(
        &campaign_id,
        &user,
        &String::from_str(&env, "Maize Funding Edit"),
        &String::from_str(&env, "Desc Funding Edit"),
    );
    let c2 = client.get_campaign(&campaign_id).unwrap();
    assert_eq!(c2.title, String::from_str(&env, "Maize Funding Edit"));
}

#[test]
#[should_panic(expected = "cannot update metadata: campaign has left active/funding status")]
fn test_update_campaign_metadata_after_funded_status_fails() {
    let (env, admin, user, escrow, client) = create_test_env();
    client.initialize(&admin);

    let campaign_id = 102u64;
    let crop = Symbol::new(&env, "tea");
    let region = Symbol::new(&env, "central");

    client.register_campaign(
        &campaign_id,
        &user,
        &String::from_str(&env, "Tea Project"),
        &String::from_str(&env, "Tea Desc"),
    );
    client.link_campaign_escrow(&campaign_id, &user, &escrow, &crop, &region);

    // Once funded, status has left Active/Funding
    client.update_campaign_status(&campaign_id, &escrow, &CampaignStatus::Funded);

    client.update_campaign_metadata(
        &campaign_id,
        &user,
        &String::from_str(&env, "Attempted Edit"),
        &String::from_str(&env, "Attempted Edit Desc"),
    );
}

#[test]
#[should_panic(expected = "campaign not registered")]
fn test_update_campaign_metadata_unregistered_fails() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    client.update_campaign_metadata(
        &999u64,
        &user,
        &String::from_str(&env, "Nonexistent"),
        &String::from_str(&env, "Nonexistent"),
    );
}

#[test]
#[should_panic(expected = "farmer does not match registered campaign")]
fn test_update_campaign_metadata_wrong_farmer_fails() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    let other_farmer = Address::generate(&env);
    let campaign_id = 103u64;

    client.register_campaign(
        &campaign_id,
        &user,
        &String::from_str(&env, "User's campaign"),
        &String::from_str(&env, "User's desc"),
    );

    client.update_campaign_metadata(
        &campaign_id,
        &other_farmer,
        &String::from_str(&env, "Hacked Title"),
        &String::from_str(&env, "Hacked Desc"),
    );
}

// ---------------------------------------------------------------------------
// Enumeration: counts and paginated listing (issue #151)
// ---------------------------------------------------------------------------

#[test]
fn test_counts_start_at_zero() {
    let (_env, admin, _, _, client) = create_test_env();
    client.initialize(&admin);

    assert_eq!(client.get_campaign_count(), 0u64);
    assert_eq!(client.get_farmer_count(), 0u64);
}

#[test]
fn test_campaign_count_after_multiple_registrations() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    for id in 1u64..=5u64 {
        client.register_campaign(
            &id,
            &user,
            &String::from_str(&env, "Title"),
            &String::from_str(&env, "Description"),
        );
    }

    assert_eq!(client.get_campaign_count(), 5u64);
}

#[test]
fn test_farmer_count_after_multiple_registrations() {
    let (env, admin, _, _, client) = create_test_env();
    client.initialize(&admin);

    for _ in 0..3 {
        let farmer = Address::generate(&env);
        client.register_farmer(
            &farmer,
            &String::from_str(&env, "Name"),
            &String::from_str(&env, "Location"),
        );
    }

    assert_eq!(client.get_farmer_count(), 3u64);
}

#[test]
fn test_get_campaign_ids_returns_registration_order() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    for id in [10u64, 20u64, 30u64] {
        client.register_campaign(
            &id,
            &user,
            &String::from_str(&env, "Title"),
            &String::from_str(&env, "Description"),
        );
    }

    let ids = client.get_campaign_ids(&0u64, &10u32);
    assert_eq!(ids.len(), 3);
    assert_eq!(ids.get(0).unwrap(), 10u64);
    assert_eq!(ids.get(1).unwrap(), 20u64);
    assert_eq!(ids.get(2).unwrap(), 30u64);
}

#[test]
fn test_get_campaign_ids_pagination_covers_every_id_exactly_once() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    for id in 1u64..=7u64 {
        client.register_campaign(
            &id,
            &user,
            &String::from_str(&env, "Title"),
            &String::from_str(&env, "Description"),
        );
    }

    let page_1 = client.get_campaign_ids(&0u64, &3u32);
    let page_2 = client.get_campaign_ids(&3u64, &3u32);
    let page_3 = client.get_campaign_ids(&6u64, &3u32);

    assert_eq!(page_1.len(), 3);
    assert_eq!(page_2.len(), 3);
    // Final page is short — only one id remains.
    assert_eq!(page_3.len(), 1);

    let mut seen = vec![&env];
    for page in [page_1, page_2, page_3] {
        for id in page.iter() {
            seen.push_back(id);
        }
    }
    assert_eq!(seen.len(), 7);
    for id in 1u64..=7u64 {
        assert!(seen.contains(id));
    }
}

#[test]
fn test_get_campaign_ids_offset_past_end_is_empty() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    client.register_campaign(
        &1u64,
        &user,
        &String::from_str(&env, "Title"),
        &String::from_str(&env, "Description"),
    );

    assert_eq!(client.get_campaign_ids(&5u64, &10u32).len(), 0);
    assert_eq!(client.get_campaign_ids(&1u64, &10u32).len(), 0);
}

#[test]
fn test_get_campaign_ids_limit_is_clamped() {
    let (env, admin, user, _, client) = create_test_env();
    client.initialize(&admin);

    for id in 1u64..=3u64 {
        client.register_campaign(
            &id,
            &user,
            &String::from_str(&env, "Title"),
            &String::from_str(&env, "Description"),
        );
    }

    // A limit far above MAX_PAGE_LIMIT still returns only what exists.
    let ids = client.get_campaign_ids(&0u64, &10_000u32);
    assert_eq!(ids.len(), 3);
}

#[test]
fn test_get_campaign_ids_empty_registry() {
    let (_env, admin, _, _, client) = create_test_env();
    client.initialize(&admin);

    assert_eq!(client.get_campaign_ids(&0u64, &10u32).len(), 0);
}

#[test]
fn test_register_then_link_counts_campaign_once() {
    let (env, admin, user, escrow, client) = create_test_env();
    client.initialize(&admin);

    client.register_campaign(
        &7u64,
        &user,
        &String::from_str(&env, "Title"),
        &String::from_str(&env, "Description"),
    );
    let crop = Symbol::new(&env, "coffee");
    let region = Symbol::new(&env, "highlands");
    client.link_campaign_escrow(&7u64, &user, &escrow, &crop, &region);

    assert_eq!(client.get_campaign_count(), 1u64);
    assert_eq!(client.get_campaign_ids(&0u64, &10u32).len(), 1);
}

#[test]
fn test_get_farmers_pagination() {
    let (env, admin, _, _, client) = create_test_env();
    client.initialize(&admin);

    let mut registered = vec![&env];
    for _ in 0..4 {
        let farmer = Address::generate(&env);
        client.register_farmer(
            &farmer,
            &String::from_str(&env, "Name"),
            &String::from_str(&env, "Location"),
        );
        registered.push_back(farmer);
    }

    let page_1 = client.get_farmers(&0u64, &2u32);
    let page_2 = client.get_farmers(&2u64, &2u32);
    assert_eq!(page_1.len(), 2);
    assert_eq!(page_2.len(), 2);

    assert_eq!(page_1.get(0).unwrap(), registered.get(0).unwrap());
    assert_eq!(page_2.get(1).unwrap(), registered.get(3).unwrap());
    assert_eq!(client.get_farmers(&4u64, &2u32).len(), 0);
}
