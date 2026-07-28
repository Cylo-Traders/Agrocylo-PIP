import { describeContractError } from './contractClient';

/**
 * Maps known on-chain panic / RPC failure substrings to short, actionable
 * copy. Contract code currently uses `panic!("…")` rather than typed
 * `#[contracterror]` codes, so we match on message text rather than `#N`.
 */
const KNOWN_FAILURES: Array<{ match: RegExp; message: string }> = [
  {
    match: /connect your wallet/i,
    message: 'Connect your wallet to continue.',
  },
  {
    match: /not configured/i,
    message:
      'Soroban RPC or contract IDs are not configured. Check your environment variables.',
  },
  {
    match: /campaign already exists/i,
    message: 'A campaign with this ID already exists.',
  },
  {
    match: /campaign already registered/i,
    message: 'This campaign is already registered.',
  },
  {
    match: /farmer already registered/i,
    message: 'This farmer is already registered.',
  },
  {
    match: /target amount must be greater than zero/i,
    message: 'Target amount must be greater than zero.',
  },
  {
    match: /amount must be positive/i,
    message: 'Amount must be greater than zero.',
  },
  {
    match: /campaign not accepting contributions/i,
    message: 'This campaign is not currently accepting contributions.',
  },
  {
    match: /contribution exceeds remaining target/i,
    message: 'Contribution exceeds the remaining funding target.',
  },
  {
    match: /campaign target not reached/i,
    message: 'The campaign funding target has not been reached yet.',
  },
  {
    match: /can only configure tranches for a funded campaign/i,
    message: 'Tranches can only be configured after a campaign is funded.',
  },
  {
    match: /total tranche amounts exceed funded amount/i,
    message: 'Total tranche amounts exceed the funded amount.',
  },
  {
    match: /amount exceeds escrow balance/i,
    message: 'Amount exceeds the escrow balance still held.',
  },
  {
    match: /cannot release tranche: campaign is in a terminal state/i,
    message: 'Cannot release a tranche for a campaign in a terminal state.',
  },
  {
    match: /campaign not funded or in production/i,
    message: 'Campaign must be funded or in production for this action.',
  },
  {
    match: /not authorized to report harvest/i,
    message: 'Only the campaign farmer can report a harvest.',
  },
  {
    match: /campaign not disputable/i,
    message: 'This campaign cannot be disputed in its current state.',
  },
  {
    match: /not authorized to open dispute/i,
    message: 'You are not authorized to open a dispute on this campaign.',
  },
  {
    match: /campaign not disputed/i,
    message: 'This campaign is not currently in dispute.',
  },
  {
    match: /dispute already resolved/i,
    message: 'This dispute has already been resolved.',
  },
  {
    match: /invalid partial settlement amount/i,
    message:
      'Partial settlement amount is invalid for the held escrow balance.',
  },
  {
    match: /no refund available|nothing to refund/i,
    message: 'No refund is available for this contribution.',
  },
  {
    match: /campaign is disputed/i,
    message: 'This action is blocked while the campaign is disputed.',
  },
  {
    match: /campaign not harvested/i,
    message: 'Campaign must be harvested before it can be settled.',
  },
  {
    match: /payout exceeds escrow balance/i,
    message: 'Payout exceeds the escrow balance still held.',
  },
  {
    match: /campaign cannot be marked failed/i,
    message: 'This campaign cannot be marked failed in its current state.',
  },
  {
    match: /campaign not settled/i,
    message: 'Campaign must be settled before returns can be claimed.',
  },
  {
    match: /nothing to return/i,
    message: 'No return payout is available for this contribution.',
  },
  {
    match: /unauthorized/i,
    message: 'You are not authorized to perform this action.',
  },
  {
    match: /user declined|rejected|denied|cancelled|canceled/i,
    message: 'Wallet signature was cancelled.',
  },
  {
    match: /network|rpc|fetch failed|failed to fetch|timeout/i,
    message: 'Network request failed. Check your connection and try again.',
  },
];

function fullErrorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  return String(err ?? '');
}

/**
 * Turns a contract/RPC/wallet failure into a short message suitable for toasts
 * and inline error banners. Prefer known panic substrings; otherwise fall back
 * to {@link describeContractError} (first diagnostic line).
 */
export function toUserFacingError(err: unknown): string {
  const text = fullErrorText(err);
  for (const { match, message } of KNOWN_FAILURES) {
    if (match.test(text)) return message;
  }
  return describeContractError(err);
}
