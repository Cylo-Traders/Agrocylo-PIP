## ProductionEscrowContract

This directory contains the Soroban contract workspace for the Agrocylo
Production Investment Layer.

### Campaign creation

`ProductionEscrowContract::create_campaign` initializes a production funding
campaign. It accepts:

- `campaign_id`: unique `BytesN<32>` campaign identifier.
- `farmer`: authorized campaign owner.
- `funding_target`: target amount; must be greater than zero.
- `token_address`: Soroban token contract address used for funding.
- `deadline`: funding deadline or timeline timestamp.
- `harvest`: expected harvest metadata, including crop type, quantity,
  expected harvest date, region, and compact metadata hash.

Creation requires `farmer.require_auth()`. Campaign IDs are globally unique and
cannot be reused. Newly created campaigns are stored with `Funding` status and a
`campaign-created` contract event is emitted after storage succeeds.

Use `get_campaign(campaign_id)` to retrieve the stored campaign details.
