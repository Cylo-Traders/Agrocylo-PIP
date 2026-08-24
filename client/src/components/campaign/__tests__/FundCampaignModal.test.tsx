import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FundCampaignModal } from '../FundCampaignModal';

const mockFundCampaign = vi.fn();
const mockUseWallet = vi.fn();
const mockConnect = vi.fn();

vi.mock('../../../hooks/contract', () => ({
  useFundCampaign: () => ({
    mutateAsync: mockFundCampaign,
    isPending: false,
  }),
}));

vi.mock('../../../context/WalletContext', () => ({
  useWallet: () => mockUseWallet(),
}));

const WALLET_ADDRESS =
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

function mockWallet(publicKey: string | null) {
  mockUseWallet.mockReturnValue({
    publicKey,
    isConnected: publicKey !== null,
    isConnecting: false,
    error: null,
    connect: mockConnect,
    disconnect: vi.fn(),
    clearError: vi.fn(),
    signTransaction: vi.fn(),
  });
}

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  campaignId: '101',
  campaignTitle: 'Organic Maize',
  totalTarget: 10000,
  currentRaised: 2000,
};

function renderModal(
  override: Partial<typeof defaultProps> & {
    onSuccess?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const props = { ...defaultProps, ...override };
  return render(<FundCampaignModal {...props} />);
}

function setAmount(value: string) {
  fireEvent.change(screen.getByLabelText(/contribution amount/i), {
    target: { value },
  });
}

describe('FundCampaignModal submit path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFundCampaign.mockResolvedValue(undefined);
    mockWallet(WALLET_ADDRESS);
  });

  it('does not call useFundCampaign when the amount is invalid', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(
      screen.getByRole('button', { name: /confirm contribution/i }),
    );

    expect(
      await screen.findByText(
        /contribution amount must be a whole number greater than zero/i,
      ),
    ).toBeInTheDocument();
    expect(mockFundCampaign).not.toHaveBeenCalled();
  });

  it('rejects an amount that exceeds the remaining target without submitting', async () => {
    const user = userEvent.setup();
    renderModal();

    setAmount('99999');
    await user.click(
      screen.getByRole('button', { name: /confirm contribution/i }),
    );

    expect(
      await screen.findByText(/exceeds remaining target/i),
    ).toBeInTheDocument();
    expect(mockFundCampaign).not.toHaveBeenCalled();
  });

  it('prompts to connect a wallet and does not submit when disconnected', async () => {
    mockWallet(null);
    renderModal();

    expect(
      screen.getByText(/connect your wallet to fund this campaign/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /confirm contribution/i }),
    ).toBeDisabled();

    setAmount('500');
    expect(mockFundCampaign).not.toHaveBeenCalled();
  });

  it('submits a real useFundCampaign mutation with campaign id, investor, and bigint amount', async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    renderModal({ onSuccess });

    setAmount('500');
    await user.click(
      screen.getByRole('button', { name: /confirm contribution/i }),
    );

    expect(mockFundCampaign).toHaveBeenCalledTimes(1);
    expect(mockFundCampaign).toHaveBeenCalledWith({
      campaignId: '101',
      investor: WALLET_ADDRESS,
      amount: 500n,
    });

    expect(
      await screen.findByText(/contribution successful/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/transaction hash/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/0x[0-9a-f]{16,}/i)).not.toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        newTotalRaised: 2500,
        newRemainingTarget: 7500,
      }),
      500,
    );
    expect(onSuccess.mock.calls[0][0].txHash).toBeUndefined();
  });

  it('surfaces a contract rejection as a readable error without a fake success hash', async () => {
    mockFundCampaign.mockRejectedValueOnce(
      new Error('HostError: panicked at campaign not accepting contributions'),
    );
    const user = userEvent.setup();
    renderModal();

    setAmount('500');
    await user.click(
      screen.getByRole('button', { name: /confirm contribution/i }),
    );

    expect(
      await screen.findByText(
        /this campaign is not currently accepting contributions/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/contribution successful/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/0x[0-9a-f]{16,}/i)).not.toBeInTheDocument();
  });
});
