import { rpc, scValToNative } from '@stellar/stellar-sdk';

/**
 * A decoded ProductionEscrowContract event.
 * `values` mirrors the payload tuple order emitted in
 * contracts/production_escrow/src/events.rs (e.g. CampaignCreated ->
 * [farmer, timestamp, target_amount]).
 */
export interface EscrowEvent {
  id: string;
  ledger: number;
  ledgerClosedAt: string;
  campaignId: string;
  name: string;
  values: unknown[];
}

export interface FetchEscrowEventsOptions {
  rpcUrl: string;
  contractId: string;
  startLedger: number;
  cursor?: string;
  maxPages?: number;
}

export const DEFAULT_LOOKBACK_LEDGERS = 120_000;
export const PAGE_LIMIT = 100;
// Hard cap on pages fetched per load so a misconfigured lookback window can't
// turn into an unbounded number of RPC round-trips from the browser.
export const MAX_PAGES = 50;

/**
 * Fetches and decodes every ProductionEscrowContract event from `startLedger`
 * to the current ledger, via the public Soroban RPC `getEvents` method. This
 * is a direct, read-only on-chain read - no backend involved.
 */
export async function fetchEscrowEvents({
  rpcUrl,
  contractId,
  startLedger,
  cursor: initialCursor,
  maxPages = MAX_PAGES,
}: FetchEscrowEventsOptions): Promise<EscrowEvent[]> {
  const server = new rpc.Server(rpcUrl);
  const events: EscrowEvent[] = [];
  let cursor: string | undefined = initialCursor;

  for (let page = 0; page < maxPages; page += 1) {
    const response = await server.getEvents({
      ...(cursor ? { cursor } : { startLedger }),
      filters: [{ type: 'contract', contractIds: [contractId] }],
      limit: PAGE_LIMIT,
    });

    for (const event of response.events) {
      const topics = event.topic.map((topic) => scValToNative(topic));
      const rawValue = scValToNative(event.value);

      events.push({
        id: event.id,
        ledger: event.ledger,
        ledgerClosedAt: event.ledgerClosedAt,
        name: String(topics[0] ?? ''),
        campaignId: topics[1] != null ? String(topics[1]) : '',
        values: Array.isArray(rawValue) ? rawValue : [rawValue],
      });
    }

    if (!response.cursor || response.events.length < PAGE_LIMIT) break;
    cursor = response.cursor;
  }

  return events;
}

export interface LoadEscrowEventsOptions {
  rpcUrl: string;
  contractId: string;
  lookbackLedgers: number;
  startLedger?: number;
}

export interface ScannedLedgerWindow {
  startLedger: number;
  latestLedger: number;
  lookbackLedgers: number;
}

/** Resolves the current ledger and fetches escrow events for the trailing `lookbackLedgers` window. */
export async function loadRecentEscrowEvents({
  rpcUrl,
  contractId,
  lookbackLedgers,
  startLedger: explicitStartLedger,
}: LoadEscrowEventsOptions): Promise<EscrowEvent[]> {
  const server = new rpc.Server(rpcUrl);
  let startLedger = explicitStartLedger;
  if (startLedger === undefined) {
    const latestLedger = await server.getLatestLedger();
    startLedger = Math.max(1, latestLedger.sequence - lookbackLedgers);
  }
  return fetchEscrowEvents({ rpcUrl, contractId, startLedger });
}

export interface LoadOlderEscrowEventsOptions {
  rpcUrl: string;
  contractId: string;
  beforeLedger: number;
  lookbackLedgers: number;
}

/**
 * Fetches events in a preceding historical window before `beforeLedger`,
 * allowing explicit pagination back through older chain history beyond the initial lookback window.
 */
export async function loadOlderEscrowEvents({
  rpcUrl,
  contractId,
  beforeLedger,
  lookbackLedgers,
}: LoadOlderEscrowEventsOptions): Promise<EscrowEvent[]> {
  const startLedger = Math.max(1, beforeLedger - lookbackLedgers);
  return fetchEscrowEvents({ rpcUrl, contractId, startLedger });
}
