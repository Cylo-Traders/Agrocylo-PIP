import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCampaign, getCampaigns, getInvestmentsByUser } from '../client';
import { ApiError, isApiError } from '../errors';

function jsonResponse(body: unknown, init: Partial<Response> = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    json: async () => body,
  } as Response;
}

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('serves local fallback data without any network call when the backend flag is off', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    // VITE_USE_BACKEND_API unset → disabled.

    const campaigns = await getCampaigns();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(campaigns.length).toBeGreaterThan(0);
    expect(campaigns[0]).toHaveProperty('id');
    // BigInt columns are transported as decimal strings.
    expect(typeof campaigns[0].totalFunded).toBe('string');
  });

  it('returns backend data when the flag is on and the request succeeds', async () => {
    vi.stubEnv('VITE_USE_BACKEND_API', 'true');
    const backendCampaigns = [
      {
        id: 'from-backend',
        farmer: 'GX',
        title: 'Backend Campaign',
        description: '',
        targetAmount: '1',
        tokenAddress: null,
        deadline: null,
        status: 'Active',
        totalFunded: '0',
        escrowContract: '',
        trancheCount: null,
        harvestOutcome: null,
        harvestReportedAt: null,
        refundable: null,
        createdAt: '1',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const fetchSpy = vi.fn(async () => jsonResponse(backendCampaigns));
    vi.stubGlobal('fetch', fetchSpy);

    const campaigns = await getCampaigns();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(campaigns[0].id).toBe('from-backend');
  });

  it('falls back to local data (no unhandled rejection) when the backend is unreachable', async () => {
    vi.stubEnv('VITE_USE_BACKEND_API', 'true');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchSpy = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', fetchSpy);

    const campaigns = await getCampaigns();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(campaigns.length).toBeGreaterThan(0);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain('getCampaigns');
  });

  it('falls back to local data when the endpoint is unimplemented (404)', async () => {
    vi.stubEnv('VITE_USE_BACKEND_API', 'true');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchSpy = vi.fn(async () =>
      jsonResponse(null, { ok: false, status: 404, statusText: 'Not Found' }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const campaigns = await getInvestmentsByUser('GINVESTOR');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(Array.isArray(campaigns)).toBe(true);
  });

  it('propagates a typed ApiError when fallback is disabled', async () => {
    vi.stubEnv('VITE_USE_BACKEND_API', 'true');
    const fetchSpy = vi.fn(async () =>
      jsonResponse(null, { ok: false, status: 404, statusText: 'Not Found' }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const error = await getCampaigns({ fallback: false }).catch((e) => e);

    expect(isApiError(error)).toBe(true);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe('http');
    expect(error.status).toBe(404);
  });

  it('throws a clear 404 ApiError for a single resource missing from the fallback set', async () => {
    // Flag off → local fallback; unknown id has no local record.
    const error = await getCampaign('does-not-exist').catch((e) => e);

    expect(isApiError(error)).toBe(true);
    expect(error.status).toBe(404);
    expect(error.message).toContain('does-not-exist');
  });
});
