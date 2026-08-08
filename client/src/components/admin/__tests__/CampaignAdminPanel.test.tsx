import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampaignAdminPanel } from '../CampaignAdminPanel';

const mockResolveDispute = vi.fn();
const mockConfigureTranches = vi.fn();
let mockTranches: {
  amount: bigint;
  milestone: string;
  released: boolean;
}[] = [];

vi.mock('../../../hooks/contract', () => ({
  useConfigureTranches: () => ({
    mutateAsync: mockConfigureTranches,
    isPending: false,
  }),
  useReleaseTranche: () => ({ mutateAsync: vi.fn(), isPending: false }),
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
  useDispute: () => ({
    data: undefined,
    isLoading: false,
  }),
}));

const FARMER = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
const TOKEN = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

function overview(status: string) {
  return {
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
      status: { tag: status as 'Disputed' },
    },
  };
}

const DISPUTED_OVERVIEW = overview('Disputed');
const FUNDED_OVERVIEW = overview('Funded');

beforeEach(() => {
  mockResolveDispute.mockReset();
  mockConfigureTranches.mockReset();
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

describe('CampaignAdminPanel configure tranches', () => {
  it('blocks submit when sum exceeds total_funded and shows running total', async () => {
    const user = userEvent.setup();
    render(<CampaignAdminPanel overview={FUNDED_OVERVIEW} />);

    expect(screen.getByTestId('tranche-running-sum')).toHaveTextContent(
      'Running total: 0 / 1000',
    );

    await user.type(screen.getByPlaceholderText('10000'), '600');
    await user.type(screen.getByPlaceholderText('planting'), 'plant');
    await user.click(screen.getByRole('button', { name: /add tranche/i }));

    const amounts = screen.getAllByPlaceholderText('10000');
    await user.type(amounts[1], '500');
    const milestones = screen.getAllByPlaceholderText('planting');
    await user.type(milestones[1], 'harvest');

    expect(screen.getByTestId('tranche-running-sum')).toHaveTextContent(
      /1100 \/ 1000/,
    );
    expect(screen.getByTestId('tranche-running-sum')).toHaveTextContent(
      /exceeds funded amount/i,
    );

    expect(
      screen.getByRole('button', { name: /configure tranches/i }),
    ).toBeDisabled();
    expect(mockConfigureTranches).not.toHaveBeenCalled();
  });

  it('allows add/remove rows and submits a valid configuration', async () => {
    mockConfigureTranches.mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(<CampaignAdminPanel overview={FUNDED_OVERVIEW} />);

    await user.type(screen.getByPlaceholderText('10000'), '400');
    await user.type(screen.getByPlaceholderText('planting'), 'plant');
    await user.click(screen.getByRole('button', { name: /add tranche/i }));

    const amounts = screen.getAllByPlaceholderText('10000');
    await user.type(amounts[1], '600');
    const milestones = screen.getAllByPlaceholderText('planting');
    await user.type(milestones[1], 'harvest');

    await user.click(
      screen.getByRole('button', { name: /remove tranche row 2/i }),
    );
    expect(screen.getAllByPlaceholderText('10000')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /add tranche/i }));
    const amounts2 = screen.getAllByPlaceholderText('10000');
    await user.type(amounts2[1], '600');
    const milestones2 = screen.getAllByPlaceholderText('planting');
    await user.type(milestones2[1], 'harvest');

    await user.click(
      screen.getByRole('button', { name: /configure tranches/i }),
    );

    expect(mockConfigureTranches).toHaveBeenCalledWith({
      campaignId: '42',
      tranches: [
        { amount: 400n, milestone: 'plant' },
        { amount: 600n, milestone: 'harvest' },
      ],
    });
    expect(
      await screen.findByText(/tranches configured/i),
    ).toBeInTheDocument();
  });

  it('shows on-chain tranche list after configuration exists', () => {
    mockTranches = [
      { amount: 400n, milestone: 'plant', released: false },
      { amount: 600n, milestone: 'harvest', released: true },
    ];
    render(<CampaignAdminPanel overview={FUNDED_OVERVIEW} />);

    const list = screen.getByTestId('configured-tranches-list');
    expect(list).toHaveTextContent('plant');
    expect(list).toHaveTextContent('harvest');
    expect(list).toHaveTextContent('Pending');
    expect(list).toHaveTextContent('Released');
  });

  it('does not show configure form for Disputed campaigns', () => {
    render(<CampaignAdminPanel overview={DISPUTED_OVERVIEW} />);
    expect(
      screen.queryByRole('button', { name: /configure tranches/i }),
    ).not.toBeInTheDocument();
  });
});
