/**
 * Typed error surfaced by the API client so callers can tell a genuine "backend
 * unreachable / not implemented yet" condition apart from a real HTTP error and
 * handle each without hitting an unhandled promise rejection.
 */

export type ApiErrorKind =
  /** The request never reached the server (DNS/connection refused/offline). */
  | 'network'
  /** The request was aborted because it exceeded the timeout. */
  | 'timeout'
  /** The server answered with a non-2xx status (e.g. 404 for an unimplemented route). */
  | 'http'
  /** A 2xx response body could not be parsed as JSON. */
  | 'parse';

export interface ApiErrorOptions {
  kind: ApiErrorKind;
  /** The request path this error relates to (e.g. `/campaigns/camp-101`). */
  endpoint: string;
  /** HTTP status code, present when `kind === 'http'`. */
  status?: number;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly endpoint: string;
  readonly status?: number;

  constructor(message: string, options: ApiErrorOptions) {
    super(
      message,
      options.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = 'ApiError';
    this.kind = options.kind;
    this.endpoint = options.endpoint;
    this.status = options.status;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
