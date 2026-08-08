import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampaignAdminPanel } from '../CampaignAdminPanel';

const mockResolveDispute = vi.fn();
const mockReleaseTranche = vi.fn();
let mockTranches: {
  amount: bigint;
  milestone: string;
  released: boolean;
}[] = [];

vi.mock('../../../hooks/contract', () => ({
  useConfigureTranches: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReleaseTranche: () => ({
    mutateAsync: mockReleaseTranche,
    isPending: false,
  }),
  useResolveDispute: () => ({
    mutateAsync: mockResolveDispute,
    isPending: false,
  }),
  useSettleCampaign: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMarkFailed: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTranches: () => ({
    data: mockTranches,
    isLoading: false,
  }),
}));

// Valid ed25519 public keys (Stellar format) so StrKey address checks pass.
const FARMER = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
const TOKEN = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

// held = total_funded - released - refundable - returnable = 1000.
const DISPUTED_OVERVIEW = {
  id: '42',
  campaign: {
    farmer: FARMER,
    target_amount: 1000n,
    token_address: TOKEN,
    deadline: 0n,
    harvest_metadata: 'maize',
    total_funded: 1000n,
    released: 0n,
    refundable: 0n,
    returnable: 0n,
    status: { tag: 'Disputed' as const },
  },
};

const FUNDED_OVERVIEW = {
  id: '7',
  campaign: {
    farmer: FARMER,
    target_amount: 1000n,
    token_address: TOKEN,
    deadline: 0n,
    harvest_metadata: 'wheat',
    total_funded: 1000n,
    released: 0n,
    refundable: 0n,
    returnable: 0n,
    status: { tag: 'Funded' as const },
  },
};

beforeEach(() => {
  mockResolveDispute.mockReset();
  mockReleaseTranche.mockReset();
  mockTranches = [];
});

describe('CampaignAdminPanel resolve dispute validation', () => {
  it('rejects an out-of-range partial settlement amount client-side, shows a readable error, and keeps the entered amount', async () => {
    const user = userEvent.setup();
    render(<CampaignAdminPanel overview={DISPUTED_OVERVIEW} />);

    await user.selectOptions(screen.getByRole('combobox'), 'PartialSettlement');

    const amountInput = await screen.findByLabelText(/payout to farmer/i);
    // Contract requires 0 < payout_amount < held (held = 1000), so 1000 is invalid.
    await user.type(amountInput, '1000');
    await user.click(screen.getByRole('button', { name: /resolve dispute/i }));

    expect(
      await screen.findByText(
        /partial settlement payout must be greater than zero/i,
      ),
    ).toBeInTheDocument();
    expect(amountInput).toHaveValue('1000');
    expect(mockResolveDispute).not.toHaveBeenCalled();
  });

  it('surfaces a contract-level rejection as a readable error without clearing the form', async () => {
    mockResolveDispute.mockRejectedValueOnce(
      new Error(
        'HostError: Error(Contract, #12)\nlong diagnostic dump that should be truncated',
      ),
    );
    const user = userEvent.setup();
    render(<CampaignAdminPanel overview={DISPUTED_OVERVIEW} />);

    await user.selectOptions(screen.getByRole('combobox'), 'PartialSettlement');
    const amountInput = await screen.findByLabelText(/payout to farmer/i);
    await user.type(amountInput, '500');
    await user.click(screen.getByRole('button', { name: /resolve dispute/i }));

    expect(
      await screen.findByText(/HostError: Error\(Contract, #12\)/),
    ).toBeInTheDocument();
    expect(amountInput).toHaveValue('500');
  });
});

describe('CampaignAdminPanel tranche release', () => {
  it('lists unreleased tranches with per-row Release and shows escrow held', async () => {
    mockTranches = [
      { amount: 400n, milestone: 'planting', released: false },
      { amount: 600n, milestone: 'harvest', released: true },
    ];
    mockReleaseTranche.mockResolvedValueOnce({});

    const user = userEvent.setup();
    render(<CampaignAdminPanel overview={FUNDED_OVERVIEW} />);

    expect(screen.getByText(/escrow held:/i)).toBeInTheDocument();
    expect(screen.getByText('planting')).toBeInTheDocument();
    expect(screen.getByText('harvest')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /release tranche planting amount 400/i }),
    ).toBeInTheDocument();
    // Released row has no action button
    expect(
      screen.queryByRole('button', { name: /release tranche harvest amount 600/i }),
    ).not.toBeInTheDocument();

    const releaseBtn = screen.getByRole('button', {
      name: /release tranche planting amount 400/i,
    });
    await user.click(releaseBtn);

    expect(mockReleaseTranche).toHaveBeenCalledWith({
      campaignId: '7',
      recipient: FARMER,
      amount: 400n,
    });
    expect(
      await screen.findByText(/released planting \(400\)/i),
    ).toBeInTheDocument();
  });

  it('does not offer release UI for disputed (terminal) campaigns', () => {
    mockTranches = [
      { amount: 500n, milestone: 'planting', released: false },
    ];
    render(<CampaignAdminPanel overview={DISPUTED_OVERVIEW} />);

    expect(
      screen.queryByRole('button', { name: /release tranche/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resolve dispute/i })).toBeInTheDocument();
  });

  it('allows ad hoc release when no tranches are configured', async () => {
    mockTranches = [];
    mockReleaseTranche.mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(<CampaignAdminPanel overview={FUNDED_OVERVIEW} />);

    expect(
      screen.getByText(/no tranches configured yet/i),
    ).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('5000'), '250');
    await user.click(
      screen.getByRole('button', { name: /^release tranche$/i }),
    );

    expect(mockReleaseTranche).toHaveBeenCalledWith({
      campaignId: '7',
      recipient: FARMER,
      amount: 250n,
    });
  });
});
