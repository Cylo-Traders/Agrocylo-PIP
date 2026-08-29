import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OpenDisputeForm } from '../components/campaign/OpenDisputeForm';
import { CampaignAdminPanel } from '../components/admin/CampaignAdminPanel';
import { ToastProvider } from '../context/ToastContext';
import { useCampaign } from '../hooks/contract';
import type { Campaign, CampaignStatusTag } from '../lib/soroban/types';

/**
 * Integration test for the open-dispute -> resolve-dispute handoff between
 * OpenDisputeForm and CampaignAdminPanel. Unlike OpenDisputeForm.test.tsx and
 * CampaignAdminPanel.test.tsx (which mock the react-query hooks directly),
 * this mocks only the lowest-level Soroban plumbing (`contractClient` +
 * `isEscrowConfigured`) so the real hooks, the real QueryClient cache, and
 * real invalidation wiring are all exercised — the thing a regression in the
 * handoff (e.g. a query-key mismatch) would actually break.
 */

const state = vi.hoisted(() => ({
  FARMER: 'GFARMER0000000000000000000000000000000000000000000000000',
  ADMIN: 'GADMIN00000000000000000000000000000000000000000000000000',
  CAMPAIGN_ID: '42',
  campaign: {
    farmer: 'GFARMER0000000000000000000000000000000000000000000000000',
    target_amount: 1000n,
    token_address: 'CTOKEN0000000000000000000000000000000000000000000000000',
    deadline: 0n,
    harvest_metadata: 'maize',
    total_funded: 1000n,
    released: 0n,
    refundable: 0n,
    returnable: 0n,
    status: { tag: 'Funded' as CampaignStatusTag },
  } as Campaign,
}));

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({ publicKey: state.FARMER, signTransaction: vi.fn() }),
}));

vi.mock('../lib/soroban/config', () => ({
  isEscrowConfigured: () => true,
  isRegistryConfigured: () => true,
}));

vi.mock('../lib/soroban/contractClient', () => ({
  getEscrowClient: () => Promise.resolve({}),
  contractMethod:
    (_client: unknown, method: string) =>
    async (_args?: Record<string, unknown>) => {
      switch (method) {
        case 'get_campaign':
          return { result: state.campaign };
        case 'get_contribution':
          return { result: 0n };
        case 'get_admin':
          return { result: state.ADMIN };
        default:
          throw new Error(`Unhandled mocked read method: ${method}`);
      }
    },
  invokeContractWrite: async (
    _clientPromise: unknown,
    method: string,
  ): Promise<undefined> => {
    if (method === 'open_dispute') {
      state.campaign = { ...state.campaign, status: { tag: 'Disputed' } };
    } else if (method === 'resolve_dispute') {
      state.campaign = { ...state.campaign, status: { tag: 'Settled' } };
    }
    return undefined;
  },
}));

function AdminSection({ campaignId }: { campaignId: string }) {
  const { data: campaign, isLoading } = useCampaign(campaignId);
  if (isLoading || !campaign) return <p>Loading admin panel…</p>;
  return <CampaignAdminPanel overview={{ id: campaignId, campaign }} />;
}

function renderLifecycle() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <OpenDisputeForm
          campaignId={state.CAMPAIGN_ID}
          farmerAddress={state.FARMER}
        />
        <AdminSection campaignId={state.CAMPAIGN_ID} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('Dispute lifecycle (open -> resolve)', () => {
  beforeEach(() => {
    state.campaign = { ...state.campaign, status: { tag: 'Funded' } };
  });

  it('opening a dispute via OpenDisputeForm surfaces it in CampaignAdminPanel, and resolving it there clears it for both', async () => {
    const user = userEvent.setup();
    renderLifecycle();

    // Before any dispute: admin panel shows Funded-status actions, not the
    // resolve-dispute form.
    await screen.findByRole('heading', { name: /configure tranches/i });
    expect(
      screen.queryByRole('heading', { name: /resolve dispute/i }),
    ).toBeNull();

    // Farmer opens a dispute.
    await user.type(
      screen.getByLabelText(/reason/i),
      'Harvest outcome does not match the report.',
    );
    await user.click(screen.getByRole('button', { name: /open dispute/i }));
    // Exact match: distinguishes the form's own inline confirmation from the
    // (differently worded) toast notification also on screen.
    expect(await screen.findByText('Dispute opened.')).toBeInTheDocument();

    // The shared query cache picks up the new Disputed status: the admin
    // panel now renders the resolve-dispute form instead of Funded actions.
    await screen.findByRole('heading', { name: /resolve dispute/i });
    expect(
      screen.queryByRole('heading', { name: /configure tranches/i }),
    ).toBeNull();

    // Admin resolves it (default resolution: FullRefund, no payout needed).
    // The campaign leaving `Disputed` unmounts ResolveDisputeForm itself (no
    // status branch renders it), so the success signal to check is the toast
    // — which outlives the form — rather than the form's own inline message.
    await user.click(
      screen.getByRole('button', { name: /^resolve dispute$/i }),
    );
    expect(await screen.findByText('Dispute resolved')).toBeInTheDocument();

    // Both components now reflect the campaign having left the Disputed
    // status.
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: /resolve dispute/i }),
      ).toBeNull();
    });
  });
});
