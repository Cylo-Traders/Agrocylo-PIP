/**
 * Minimal typed `fetch` wrapper for GET requests against the backend REST API.
 * Uses the platform `fetch` (no extra dependency) and turns every failure mode
 * into a typed {@link ApiError} so callers never face an opaque rejection.
 */
import { backendApiBaseUrl, DEFAULT_REQUEST_TIMEOUT_MS } from './config';
import { ApiError } from './errors';

export interface ApiFetchOptions {
  /** Caller-provided abort signal (e.g. from react-query). Combined with the timeout. */
  signal?: AbortSignal;
  /** Override the default request timeout in milliseconds. */
  timeoutMs?: number;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const endpoint = path.startsWith('/') ? path : `/${path}`;
  const url = `${backendApiBaseUrl()}${endpoint}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', () => controller.abort(), {
        once: true,
      });
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (cause) {
    // An aborted controller means we hit the timeout; anything else is a
    // genuine connection failure (server down / offline / CORS).
    const timedOut = controller.signal.aborted;
    throw new ApiError(
      timedOut
        ? `Request to ${endpoint} timed out after ${timeoutMs}ms`
        : `Network request to ${endpoint} failed — backend unreachable`,
      { kind: timedOut ? 'timeout' : 'network', endpoint, cause },
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const hint =
      response.status === 404 ? ' — endpoint not implemented yet?' : '';
    throw new ApiError(
      `Backend responded ${response.status} ${response.statusText} for ${endpoint}${hint}`,
      { kind: 'http', endpoint, status: response.status },
    );
  }

  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new ApiError(`Failed to parse JSON response from ${endpoint}`, {
      kind: 'parse',
      endpoint,
      cause,
    });
  }
}
