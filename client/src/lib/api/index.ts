/**
 * Typed REST API client for the backend, with local fallback (issue #61).
 *
 * Usage:
 *   import { getCampaigns, isBackendApiEnabled } from '@/lib/api';
 *
 * See `client.ts` for the assumed backend endpoints and fallback behaviour.
 */
export {
  getCampaigns,
  getCampaign,
  getCampaignInvestments,
  getCampaignOrders,
  getOrder,
  getUser,
  getInvestmentsByUser,
  getTransactionsByUser,
} from './client';
export type { ApiRequestOptions } from './client';

export {
  isBackendApiEnabled,
  backendApiBaseUrl,
  DEFAULT_BACKEND_API_URL,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from './config';

export { ApiError, isApiError } from './errors';
export type { ApiErrorKind, ApiErrorOptions } from './errors';

export { apiFetch } from './http';
export type { ApiFetchOptions } from './http';

export { localData } from './fallback';

export type {
  Campaign,
  Investment,
  Order,
  User,
  Transaction,
  NumericString,
  IsoDateString,
} from './types';
