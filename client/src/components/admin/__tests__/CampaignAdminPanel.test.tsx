import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampaignAdminPanel } from '../CampaignAdminPanel';

const mockResolveDispute = vi.fn();

vi.mock('../../../hooks/contract', () => ({
  useConfigureTranches: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReleaseTranche: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResolveDispute: () => ({
    mutateAsync: mockResolveDispute,
    isPending: false,
  }),
  useSettleCampaign: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMarkFailed: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// held = total_funded - released - refundable - returnable = 1000.
const DISPUTED_OVERVIEW = {
  id: '42',
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
    status: { tag: 'Disputed' as const },
  },
};

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
