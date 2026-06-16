extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    vec, Address, BytesN, Env, IntoVal, String,
};

fn campaign_id(env: &Env, tag: u8) -> BytesN<32> {
    BytesN::from_array(env, &[tag; 32])
}

fn metadata_hash(env: &Env, tag: u8) -> BytesN<32> {
    BytesN::from_array(env, &[tag; 32])
}

fn harvest(env: &Env) -> HarvestMetadata {
    HarvestMetadata {
        crop_type: String::from_str(env, "maize"),
        expected_quantity: 5_000,
        expected_harvest_date: 1_800_000_000,
        region: String::from_str(env, "kaduna"),
        metadata_hash: metadata_hash(env, 9),
    }
}

#[test]
fn farmer_can_create_and_retrieve_campaign() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ProductionEscrowContract, ());
    let client = ProductionEscrowContractClient::new(&env, &contract_id);

    let id = campaign_id(&env, 1);
    let farmer = Address::generate(&env);
    let token = Address::generate(&env);
    let funding_target = 25_000_000_i128;
    let deadline = 1_750_000_000_u64;
    let harvest = harvest(&env);

    let created =
        client.create_campaign(&id, &farmer, &funding_target, &token, &deadline, &harvest);

    assert_eq!(
        created,
        Campaign {
            campaign_id: id.clone(),
            farmer: farmer.clone(),
            funding_target,
            token_address: token.clone(),
            deadline,
            harvest: harvest.clone(),
            status: CampaignStatus::Funding,
        }
    );

    let stored = client.get_campaign(&id);
    assert_eq!(stored, created);
}

#[test]
fn create_campaign_emits_campaign_created_event() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ProductionEscrowContract, ());
    let client = ProductionEscrowContractClient::new(&env, &contract_id);

    let id = campaign_id(&env, 2);
    let farmer = Address::generate(&env);
    let token = Address::generate(&env);
    let funding_target = 30_000_000_i128;
    let deadline = 1_760_000_000_u64;
    let harvest = harvest(&env);

    client.create_campaign(&id, &farmer, &funding_target, &token, &deadline, &harvest);

    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                contract_id,
                (
                    String::from_str(&env, "campaign-created"),
                    id.clone(),
                    farmer.clone(),
                )
                    .into_val(&env),
                CampaignCreatedEvent {
                    campaign_id: id,
                    farmer,
                    funding_target,
                    token_address: token,
                    status: CampaignStatus::Funding,
                }
                .into_val(&env),
            ),
        ]
    );
}

#[test]
fn duplicate_campaign_id_is_rejected_without_overwrite_or_event() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ProductionEscrowContract, ());
    let client = ProductionEscrowContractClient::new(&env, &contract_id);

    let id = campaign_id(&env, 3);
    let farmer = Address::generate(&env);
    let other_farmer = Address::generate(&env);
    let token = Address::generate(&env);
    let funding_target = 10_000_000_i128;
    let deadline = 1_770_000_000_u64;
    let harvest = harvest(&env);

    let first = client.create_campaign(&id, &farmer, &funding_target, &token, &deadline, &harvest);

    assert_eq!(
        client.try_create_campaign(
            &id,
            &other_farmer,
            &(funding_target + 1),
            &token,
            &(deadline + 1),
            &harvest,
        ),
        Err(Ok(ProductionEscrowError::DuplicateCampaignId))
    );

    assert_eq!(client.get_campaign(&id), first);
}

#[test]
fn zero_funding_target_is_rejected_without_storage_or_event() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ProductionEscrowContract, ());
    let client = ProductionEscrowContractClient::new(&env, &contract_id);

    let id = campaign_id(&env, 4);
    let farmer = Address::generate(&env);
    let token = Address::generate(&env);
    let deadline = 1_780_000_000_u64;
    let harvest = harvest(&env);

    assert_eq!(
        client.try_create_campaign(&id, &farmer, &0_i128, &token, &deadline, &harvest),
        Err(Ok(ProductionEscrowError::InvalidFundingTarget))
    );
    assert_eq!(
        client.try_get_campaign(&id),
        Err(Ok(ProductionEscrowError::CampaignNotFound))
    );
    assert_eq!(env.events().all().events().len(), 0);
}

#[test]
fn negative_funding_target_is_rejected_without_storage_or_event() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ProductionEscrowContract, ());
    let client = ProductionEscrowContractClient::new(&env, &contract_id);

    let id = campaign_id(&env, 5);
    let farmer = Address::generate(&env);
    let token = Address::generate(&env);
    let deadline = 1_790_000_000_u64;
    let harvest = harvest(&env);

    assert_eq!(
        client.try_create_campaign(&id, &farmer, &-1_i128, &token, &deadline, &harvest),
        Err(Ok(ProductionEscrowError::InvalidFundingTarget))
    );
    assert_eq!(
        client.try_get_campaign(&id),
        Err(Ok(ProductionEscrowError::CampaignNotFound))
    );
    assert_eq!(env.events().all().events().len(), 0);
}

#[test]
fn unauthorized_creation_is_rejected_without_storage_or_event() {
    let env = Env::default();

    let contract_id = env.register(ProductionEscrowContract, ());
    let client = ProductionEscrowContractClient::new(&env, &contract_id);

    let id = campaign_id(&env, 6);
    let farmer = Address::generate(&env);
    let token = Address::generate(&env);
    let funding_target = 15_000_000_i128;
    let deadline = 1_800_000_000_u64;
    let harvest = harvest(&env);

    assert!(client
        .try_create_campaign(&id, &farmer, &funding_target, &token, &deadline, &harvest,)
        .is_err());
    assert_eq!(
        client.try_get_campaign(&id),
        Err(Ok(ProductionEscrowError::CampaignNotFound))
    );
    assert_eq!(env.events().all().events().len(), 0);
}

#[test]
fn missing_campaign_returns_not_found() {
    let env = Env::default();

    let contract_id = env.register(ProductionEscrowContract, ());
    let client = ProductionEscrowContractClient::new(&env, &contract_id);

    assert_eq!(
        client.try_get_campaign(&campaign_id(&env, 7)),
        Err(Ok(ProductionEscrowError::CampaignNotFound))
    );
}
