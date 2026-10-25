import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampaignAdminPanel } from '../CampaignAdminPanel';

const mockResolveDispute = vi.fn();
let mockDispute:
  | {
      opener: string;
      reason: string;
      status: { tag: string };
    }
  | undefined;

vi.mock('../../../hooks/contract', () => ({
  useConfigureTranches: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReleaseTranche: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResolveDispute: () => ({
    mutateAsync: mockResolveDispute,
    isPending: false,
  }),
  useSettleCampaign: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMarkFailed: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDispute: () => ({
    data: mockDispute,
    isLoading: false,
  }),
}));

const FARMER = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
const OPENER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

const DISPUTED_OVERVIEW = {
  id: '42',
  campaign: {
    farmer: FARMER,
    target_amount: 1000n,
    token_address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    deadline: 0n,
    harvest_metadata: 'maize',
    total_funded: 1000n,
    released: 0n,
    refundable: 0n,
    returnable: 0n,
    status: { tag: 'Disputed' as const },
  },
};

beforeEach(() => {
  mockResolveDispute.mockReset();
  mockDispute = {
    opener: OPENER,
    reason: 'delay',
    status: { tag: 'Open' },
  };
});

describe('CampaignAdminPanel resolve dispute validation', () => {
  it('rejects an out-of-range partial settlement amount client-side, shows a readable error, and keeps the entered amount', async () => {
    const user = userEvent.setup();
    render(<CampaignAdminPanel overview={DISPUTED_OVERVIEW} />);

    await user.selectOptions(screen.getByRole('combobox'), 'PartialSettlement');

    const amountInput = await screen.findByLabelText(/payout to farmer/i);
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

  it('shows dispute opener/reason and only shows payout for PartialSettlement', async () => {
    const user = userEvent.setup();
    render(<CampaignAdminPanel overview={DISPUTED_OVERVIEW} />);

    expect(screen.getByTestId('dispute-details')).toHaveTextContent(OPENER);
    expect(screen.getByTestId('dispute-details')).toHaveTextContent('delay');

    // FullRefund: no payout field
    expect(screen.queryByLabelText(/payout to farmer/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('dispute-split-preview')).toHaveTextContent(
      /farmer payout: 0/,
    );
    expect(screen.getByTestId('dispute-split-preview')).toHaveTextContent(
      /refundable: 1000/,
    );

    await user.selectOptions(screen.getByRole('combobox'), 'PartialSettlement');
    expect(screen.getByLabelText(/payout to farmer/i)).toBeInTheDocument();
  });

  it('submits FullRefund with zero payout amount automatically', async () => {
    mockResolveDispute.mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(<CampaignAdminPanel overview={DISPUTED_OVERVIEW} />);

    await user.click(screen.getByRole('button', { name: /resolve dispute/i }));

    expect(mockResolveDispute).toHaveBeenCalledWith({
      campaignId: '42',
      resolution: 'FullRefund',
      payoutAmount: 0n,
    });
    expect(await screen.findByText(/dispute resolved/i)).toBeInTheDocument();
    expect(screen.getByText(/farmer 0, refundable 1000/i)).toBeInTheDocument();
  });

  it('submits PartialSettlement with farmer/refundable split', async () => {
    mockResolveDispute.mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(<CampaignAdminPanel overview={DISPUTED_OVERVIEW} />);

    await user.selectOptions(screen.getByRole('combobox'), 'PartialSettlement');
    await user.type(screen.getByLabelText(/payout to farmer/i), '400');
    expect(screen.getByTestId('dispute-split-preview')).toHaveTextContent(
      /farmer payout: 400/,
    );
    expect(screen.getByTestId('dispute-split-preview')).toHaveTextContent(
      /refundable: 600/,
    );

    await user.click(screen.getByRole('button', { name: /resolve dispute/i }));

    expect(mockResolveDispute).toHaveBeenCalledWith({
      campaignId: '42',
      resolution: 'PartialSettlement',
      payoutAmount: 400n,
    });
  });
});
