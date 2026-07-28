/**
 * Configuration for the backend REST API client.
 *
 * The backend (`server/`, NestJS) currently only serves `/health`; the data
 * endpoints assumed by this client (see `client.ts`) are not implemented yet.
 * `VITE_USE_BACKEND_API` is therefore the master toggle: while it is off (the
 * default) the client serves local fallback data and never touches the network,
 * so the app keeps working against direct contract reads. Once the backend
 * ships the endpoints, flipping the flag on lets hooks (issue #9) prefer
 * backend-indexed reads.
 */

/** Default backend origin (matches the NestJS server's default port 3000). */
export const DEFAULT_BACKEND_API_URL = 'http://localhost:3000';

/** Default per-request timeout before a call is treated as "backend unreachable". */
export const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

/** Absolute base URL for the backend API, with any trailing slashes stripped. */
export function backendApiBaseUrl(): string {
  const raw = import.meta.env.VITE_BACKEND_API_URL?.trim();
  const base = raw && raw.length > 0 ? raw : DEFAULT_BACKEND_API_URL;
  return base.replace(/\/+$/, '');
}

/**
 * Whether the app should prefer backend-indexed data over direct contract
 * reads. Accepts `true` / `1` / `yes` (case-insensitive); anything else — or an
 * unset variable — is treated as off.
 */
export function isBackendApiEnabled(): boolean {
  const flag = import.meta.env.VITE_USE_BACKEND_API?.trim().toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
}
