import type { CampaignStatusTag } from '../soroban/types';

/**
 * Which authorization rule (if any) lets the connected wallet open a dispute.
 * Mirrors the contract's `open_dispute` check: the campaign farmer, any wallet
 * with a non-zero contribution, or the escrow admin.
 */
export type DisputeOpenerRole = 'farmer' | 'contributor' | 'admin';

/** Campaign statuses during which a dispute may still be opened. */
export const DISPUTABLE_STATUSES: CampaignStatusTag[] = [
  'Active',
  'Funding',
  'Funded',
];

/** Maximum reason length accepted by the short form. */
export const DISPUTE_REASON_MAX_LENGTH = 500;

export interface DisputeEligibilityInput {
  status: CampaignStatusTag | undefined;
  /** Connected wallet address, or null when no wallet is connected. */
  walletAddress: string | null | undefined;
  /** Campaign's farmer address. */
  farmer: string | undefined;
  /** Escrow contract admin address. */
  admin: string | undefined;
  /** Connected wallet's contribution to this campaign, in stroops. */
  contribution: bigint | undefined;
}

export interface DisputeEligibility {
  /** True only when the wallet satisfies the contract's authorization rule. */
  eligible: boolean;
  /** The rule that granted access, or null when not eligible. */
  role: DisputeOpenerRole | null;
  /**
   * Why the wallet cannot open a dispute, suitable for a tooltip. Null when
   * eligible.
   */
  reason: string | null;
}

const NOT_ELIGIBLE = (reason: string): DisputeEligibility => ({
  eligible: false,
  role: null,
  reason,
});

/**
 * Decides whether the connected wallet may open a dispute on a campaign.
 *
 * This is a UX affordance, not the authorization boundary — the contract
 * re-checks the same rule and rejects unauthorized callers regardless of what
 * the UI shows.
 */
export function evaluateDisputeEligibility(
  input: DisputeEligibilityInput,
): DisputeEligibility {
  const { status, walletAddress, farmer, admin, contribution } = input;

  if (!walletAddress) {
    return NOT_ELIGIBLE('Connect your wallet to open a dispute.');
  }

  if (!status) {
    return NOT_ELIGIBLE('Campaign status is still loading.');
  }

  if (!DISPUTABLE_STATUSES.includes(status)) {
    return NOT_ELIGIBLE(
      `Disputes can only be opened while a campaign is ${DISPUTABLE_STATUSES.join(
        ', ',
      )}.`,
    );
  }

  // Order matters only for which role is reported; any single match grants
  // access. Farmer first, then admin, then contributor — most specific to the
  // campaign first.
  if (farmer && walletAddress === farmer) {
    return { eligible: true, role: 'farmer', reason: null };
  }

  if (admin && walletAddress === admin) {
    return { eligible: true, role: 'admin', reason: null };
  }

  if (contribution !== undefined && contribution > 0n) {
    return { eligible: true, role: 'contributor', reason: null };
  }

  return NOT_ELIGIBLE(
    'Only the campaign farmer, a contributing investor, or an admin can open a dispute.',
  );
}

export interface ReasonValidation {
  valid: boolean;
  error: string | null;
}

/**
 * Client-side validation for the dispute reason. The reason is required; the
 * contract stores it verbatim, so it is also length-capped here.
 */
export function validateDisputeReason(reason: string): ReasonValidation {
  const trimmed = reason.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'A reason is required to open a dispute.' };
  }

  if (trimmed.length > DISPUTE_REASON_MAX_LENGTH) {
    return {
      valid: false,
      error: `Reason must be ${DISPUTE_REASON_MAX_LENGTH} characters or fewer.`,
    };
  }

  return { valid: true, error: null };
}
