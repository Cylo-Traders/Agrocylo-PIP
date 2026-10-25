import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampaignAdminPanel } from '../CampaignAdminPanel';

const mockResolveDispute = vi.fn();
const mockSettleCampaign = vi.fn();
const mockMarkFailed = vi.fn();

vi.mock('../../../hooks/contract', () => ({
  useConfigureTranches: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReleaseTranche: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResolveDispute: () => ({
    mutateAsync: mockResolveDispute,
    isPending: false,
  }),
  useSettleCampaign: () => ({
    mutateAsync: mockSettleCampaign,
    isPending: false,
  }),
  useMarkFailed: () => ({
    mutateAsync: mockMarkFailed,
    isPending: false,
  }),
}));

const FARMER = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
const TOKEN = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

function overview(
  status: string,
  overrides: Partial<{
    total_funded: bigint;
    released: bigint;
    refundable: bigint;
    returnable: bigint;
  }> = {},
) {
  return {
    id: '9',
    campaign: {
      farmer: FARMER,
      target_amount: 1000n,
      token_address: TOKEN,
      deadline: 0n,
      harvest_metadata: 'maize',
      total_funded: overrides.total_funded ?? 1000n,
      released: overrides.released ?? 0n,
      refundable: overrides.refundable ?? 0n,
      returnable: overrides.returnable ?? 0n,
      status: { tag: status as 'Disputed' },
    },
  };
}

// held = total_funded - released - refundable - returnable = 1000.
const DISPUTED_OVERVIEW = overview('Disputed');

beforeEach(() => {
  mockResolveDispute.mockReset();
  mockSettleCampaign.mockReset();
  mockMarkFailed.mockReset();
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

describe('CampaignAdminPanel settle & mark failed', () => {
  it('caps settle payout at escrow held and shows returnable preview', async () => {
    const user = userEvent.setup();
    // held = 800
    render(
      <CampaignAdminPanel
        overview={overview('Harvested', { released: 200n })}
      />,
    );

    expect(
      screen.getByRole('button', { name: /settle campaign/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/maximum 800/i)).toBeInTheDocument();
    // Mark failed must not appear on Harvested (contract forbids it).
    expect(
      screen.queryByRole('button', { name: /mark campaign as failed/i }),
    ).not.toBeInTheDocument();

    const payout = screen.getByLabelText(/farmer payout/i);
    await user.type(payout, '900');
    await user.click(screen.getByRole('button', { name: /settle campaign/i }));

    expect(
      await screen.findByText(/payout exceeds the escrow balance still held/i),
    ).toBeInTheDocument();
    expect(mockSettleCampaign).not.toHaveBeenCalled();
    expect(payout).toHaveValue('900');
  });

  it('submits a valid settle and shows investor returnable preview before submit', async () => {
    mockSettleCampaign.mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(
      <CampaignAdminPanel
        overview={overview('Harvested', { released: 200n })}
      />,
    );

    const payout = screen.getByLabelText(/farmer payout/i);
    await user.type(payout, '500');
    expect(
      screen.getByText(/investor returnable after settle: 300/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /settle campaign/i }));

    expect(mockSettleCampaign).toHaveBeenCalledWith({
      campaignId: '9',
      farmer: FARMER,
      farmerPayout: 500n,
    });
    expect(await screen.findByText(/campaign settled/i)).toBeInTheDocument();
  });

  it('requires confirmation before mark failed and only shows for Funded', async () => {
    mockMarkFailed.mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(<CampaignAdminPanel overview={overview('Funded')} />);

    const markBtn = screen.getByRole('button', {
      name: /mark campaign as failed/i,
    });
    await user.click(markBtn);

    // Must confirm — no immediate mutation
    expect(mockMarkFailed).not.toHaveBeenCalled();
    const confirmBtn = screen.getByRole('button', {
      name: /confirm: mark as failed/i,
    });
    await user.click(confirmBtn);

    expect(mockMarkFailed).toHaveBeenCalledWith({ campaignId: '9' });
    expect(
      await screen.findByText(/campaign marked as failed/i),
    ).toBeInTheDocument();
  });

  it('does not show settle form for Funded campaigns', () => {
    render(<CampaignAdminPanel overview={overview('Funded')} />);
    expect(
      screen.queryByRole('button', { name: /settle campaign/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /mark campaign as failed/i }),
    ).toBeInTheDocument();
  });
});
