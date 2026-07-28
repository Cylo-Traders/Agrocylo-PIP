/**
 * Typed REST API client for the Agrocylo backend, with local fallback.
 *
 * The backend (`server/`, NestJS) currently only exposes `GET /health`. The
 * data endpoints below are the *assumed contract* the frontend is built
 * against; the backend team can implement them to this shape. Until then — or
 * whenever the backend is unreachable — every function falls back to the local
 * dataset in `fallback.ts`, so nothing throws an unhandled rejection.
 *
 * Behaviour:
 *   - `VITE_USE_BACKEND_API` off (default) → serve local data, no network call.
 *   - `VITE_USE_BACKEND_API` on            → hit the backend; on failure
 *                                            (network / timeout / 404 / parse)
 *                                            log a clear warning and fall back
 *                                            to local data, unless the caller
 *                                            passes `{ fallback: false }`, in
 *                                            which case the typed `ApiError`
 *                                            propagates for the caller to
 *                                            handle.
 *
 * Assumed endpoints (all GET, all JSON; BigInt columns as decimal strings):
 *   GET /campaigns                        → Campaign[]
 *   GET /campaigns/:id                    → Campaign
 *   GET /campaigns/:id/investments        → Investment[]
 *   GET /campaigns/:id/orders             → Order[]
 *   GET /orders/:id                       → Order
 *   GET /users/:address                   → User
 *   GET /users/:address/investments       → Investment[]
 *   GET /users/:address/transactions      → Transaction[]
 *
 * Response shapes are defined in `types.ts` and mirror the Prisma models in
 * `server/prisma/schema.prisma`. Keep this list in sync as the backend grows.
 */
import { isBackendApiEnabled } from './config';
import { ApiError } from './errors';
import { localData } from './fallback';
import { apiFetch, type ApiFetchOptions } from './http';
import type { Campaign, Investment, Order, Transaction, User } from './types';

export interface ApiRequestOptions extends ApiFetchOptions {
  /**
   * When true (default), an unreachable / unimplemented backend endpoint
   * resolves to local fallback data instead of rejecting. Set to false to
   * receive the raw {@link ApiError} (e.g. once the backend is live and you
   * want real error surfaces in the UI).
   */
  fallback?: boolean;
}

const encode = encodeURIComponent;

/**
 * Runs `attempt` against the backend when enabled, otherwise (or on failure
 * with fallback allowed) returns `useLocal()`. Never rejects unless the backend
 * is enabled, fails, and `allowFallback` is false.
 */
async function resolveWith<T>(
  context: string,
  attempt: () => Promise<T>,
  localFn: () => T,
  allowFallback: boolean,
): Promise<T> {
  if (!isBackendApiEnabled()) {
    return localFn();
  }
  try {
    return await attempt();
  } catch (error) {
    if (!allowFallback) {
      throw error;
    }
    const detail = error instanceof ApiError ? error.message : String(error);
    console.warn(
      `[api] ${context} failed; using local fallback data. ${detail}`,
    );
    return localFn();
  }
}

/** Throws a clear, typed not-found error for single-resource lookups. */
function requireFound<T>(value: T | undefined, endpoint: string): T {
  if (value === undefined) {
    throw new ApiError(`No record found for ${endpoint}`, {
      kind: 'http',
      endpoint,
      status: 404,
    });
  }
  return value;
}

function splitOptions(options: ApiRequestOptions): {
  fetchOptions: ApiFetchOptions;
  allowFallback: boolean;
} {
  const { fallback = true, ...fetchOptions } = options;
  return { fetchOptions, allowFallback: fallback };
}

export function getCampaigns(
  options: ApiRequestOptions = {},
): Promise<Campaign[]> {
  const { fetchOptions, allowFallback } = splitOptions(options);
  return resolveWith(
    'getCampaigns',
    () => apiFetch<Campaign[]>('/campaigns', fetchOptions),
    () => localData.campaigns(),
    allowFallback,
  );
}

export function getCampaign(
  id: string,
  options: ApiRequestOptions = {},
): Promise<Campaign> {
  const { fetchOptions, allowFallback } = splitOptions(options);
  const endpoint = `/campaigns/${encode(id)}`;
  return resolveWith(
    `getCampaign(${id})`,
    () => apiFetch<Campaign>(endpoint, fetchOptions),
    () => requireFound(localData.campaign(id), endpoint),
    allowFallback,
  );
}

export function getCampaignInvestments(
  campaignId: string,
  options: ApiRequestOptions = {},
): Promise<Investment[]> {
  const { fetchOptions, allowFallback } = splitOptions(options);
  return resolveWith(
    `getCampaignInvestments(${campaignId})`,
    () =>
      apiFetch<Investment[]>(
        `/campaigns/${encode(campaignId)}/investments`,
        fetchOptions,
      ),
    () => localData.campaignInvestments(campaignId),
    allowFallback,
  );
}

export function getCampaignOrders(
  campaignId: string,
  options: ApiRequestOptions = {},
): Promise<Order[]> {
  const { fetchOptions, allowFallback } = splitOptions(options);
  return resolveWith(
    `getCampaignOrders(${campaignId})`,
    () =>
      apiFetch<Order[]>(
        `/campaigns/${encode(campaignId)}/orders`,
        fetchOptions,
      ),
    () => localData.campaignOrders(campaignId),
    allowFallback,
  );
}

export function getOrder(
  id: string,
  options: ApiRequestOptions = {},
): Promise<Order> {
  const { fetchOptions, allowFallback } = splitOptions(options);
  const endpoint = `/orders/${encode(id)}`;
  return resolveWith(
    `getOrder(${id})`,
    () => apiFetch<Order>(endpoint, fetchOptions),
    () => requireFound(localData.order(id), endpoint),
    allowFallback,
  );
}

export function getUser(
  address: string,
  options: ApiRequestOptions = {},
): Promise<User> {
  const { fetchOptions, allowFallback } = splitOptions(options);
  const endpoint = `/users/${encode(address)}`;
  return resolveWith(
    `getUser(${address})`,
    () => apiFetch<User>(endpoint, fetchOptions),
    () => requireFound(localData.user(address), endpoint),
    allowFallback,
  );
}

export function getInvestmentsByUser(
  address: string,
  options: ApiRequestOptions = {},
): Promise<Investment[]> {
  const { fetchOptions, allowFallback } = splitOptions(options);
  return resolveWith(
    `getInvestmentsByUser(${address})`,
    () =>
      apiFetch<Investment[]>(
        `/users/${encode(address)}/investments`,
        fetchOptions,
      ),
    () => localData.investmentsByUser(address),
    allowFallback,
  );
}

export function getTransactionsByUser(
  address: string,
  options: ApiRequestOptions = {},
): Promise<Transaction[]> {
  const { fetchOptions, allowFallback } = splitOptions(options);
  return resolveWith(
    `getTransactionsByUser(${address})`,
    () =>
      apiFetch<Transaction[]>(
        `/users/${encode(address)}/transactions`,
        fetchOptions,
      ),
    () => localData.transactionsByUser(address),
    allowFallback,
  );
}
