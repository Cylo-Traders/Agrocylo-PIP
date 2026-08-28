export function validateContribution(
  amount: number | string,
  remainingTarget: number,
): { valid: boolean; error?: string } {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount) || numAmount <= 0) {
    return {
      valid: false,
      error: 'Contribution amount must be greater than zero',
    };
  }

  if (numAmount > remainingTarget) {
    return {
      valid: false,
      error: `Contribution amount (${numAmount}) exceeds remaining target (${remainingTarget})`,
    };
  }

  return { valid: true };
}

export function calculateOwnershipShare(
  amount: number,
  totalTarget: number,
): number {
  if (totalTarget <= 0 || amount <= 0) return 0;
  const share = (amount / totalTarget) * 100;
  return Math.min(100, Math.round(share * 100) / 100);
}
