# Campaign Discovery & Lookback Strategy

## Background & Problem

In Agrocylo-PIP, the `ProductionEscrowContract` does not maintain an unbounded global list of all campaign IDs on-chain to minimize storage rent and gas costs. Consequently, client-side discovery (`useAdminCampaigns`, `useCampaignAnalytics`, and `useAllCampaigns`) relies on scanning contract events (`CampaignCreated`, `ContribReceived`, etc.) backwards from the latest ledger by a bounded lookback window (`LOOKBACK_LEDGERS`, default 120,000 ledgers / ~7 days).

Because Soroban RPC providers enforce event retention limits and bounded queries, any campaign created before the lookback window would otherwise become permanently invisible to the Admin Dashboard and Analytics Dashboard if not handled deliberately.

## Multi-Tiered Discovery Strategy

To ensure zero silent data loss and scalable discovery as ledger history grows, Agrocylo-PIP implements a four-tiered discovery strategy:

```
+---------------------------------------------------------------+
|  Tier 1: Bounded RPC Event Scanning (Default Recent Window)   |
|  - Fast, read-only on-chain discovery for trailing ~7 days    |
|  - Configured via VITE_SOROBAN_EVENTS_LOOKBACK_LEDGERS        |
+---------------------------------------------------------------+
                               |
                               v
+---------------------------------------------------------------+
|  Tier 2: Explicit Pagination & "Load Older" Range Stepping    |
|  - Admin can step back via `loadOlderEscrowEvents` in blocks  |
|  - Interactive "Load older history" in Admin Dashboard        |
+---------------------------------------------------------------+
                               |
                               v
+---------------------------------------------------------------+
|  Tier 3: On-Chain Registry Enumeration                        |
|  - RegistryContract stores linked campaign records by farmer  |
|  - `get_campaigns_by_farmer_page` supports bounded on-chain   |
|    reads without event log retention limits                   |
+---------------------------------------------------------------+
                               |
                               v
+---------------------------------------------------------------+
|  Tier 4: Backend Indexing & REST API (`lib/api`)              |
|  - NestJS indexer captures all events into PostgreSQL         |
|  - Full historical discovery via `GET /campaigns`             |
|  - Activated when `VITE_USE_BACKEND_API=true`                 |
+---------------------------------------------------------------+
```

### 1. UI Visibility & Notice Banners (Tier 1)

- **Admin Dashboard**: Displays an active status region indicating the lookback window limit in ledgers and days. It provides an explicit button to load older history by incrementing the lookback multiplier.
- **Analytics Dashboard**: Displays an informative banner explaining that aggregate charts and metrics reflect the trailing lookback window and advises enabling backend analytics for multi-year historical reports.

### 2. Explicit History Pagination (Tier 2)

- Implemented via `loadOlderEscrowEvents({ rpcUrl, contractId, beforeLedger, lookbackLedgers })` and `useAdminCampaigns({ lookbackLedgers })`.
- Allows stepping through consecutive ledger ranges `[latest - 2 * LOOKBACK, latest - LOOKBACK]` without exceeding RPC response size or memory limits.

### 3. Registry-Based Enumeration (Tier 3)

- `RegistryContract` provides on-chain campaign indexing via `get_campaigns_by_farmer(farmer)` and `get_campaigns_by_farmer_page(farmer, page)`.
- When an administrator or user inspects a specific farmer profile, all historical campaigns for that identity are discoverable directly from contract instance storage regardless of event retention age.

### 4. Backend Indexed Source of Truth (Tier 4)

- When `VITE_USE_BACKEND_API` is enabled, `useAdminCampaigns` and `useAllCampaigns` query `getCampaigns()` from `lib/api/client.ts`.
- The backend indexer persists every `CampaignCreated` event in the database, allowing instant `O(1)` retrieval across complete chain history.

## Acceptance & Test Verification

The lookback behavior and strategy are tested across:

- `client/src/lib/soroban/__tests__/eventsLookback.test.ts`: Simulates campaign events inside vs. outside the lookback window, verifying that `loadRecentEscrowEvents` bounds its query, `loadOlderEscrowEvents` retrieves older ranges, and lookback expansion discovers older campaigns.
- `client/src/pages/__tests__/AdminDashboardPage.test.tsx` & `AnalyticsDashboardPage`: Verifies UI notification banners and interaction for lookback window limits.
