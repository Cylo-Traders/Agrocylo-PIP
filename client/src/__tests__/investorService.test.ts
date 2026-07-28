import {
  getInvestorPortfolio,
  calculatePortfolioStats,
  claimRefund,
  claimReturn,
} from '../lib/soroban/investorService';

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || 'Expected true, got false');
  }
}

// 1. Portfolio Filter & Empty State Tests
const userPortfolio = getInvestorPortfolio('GDF4...M9XZ');
assertEqual(userPortfolio.length, 3);

const emptyPortfolio = getInvestorPortfolio('UNFUNDED_WALLET_ADDRESS');
assertEqual(emptyPortfolio.length, 0);

// 2. Stats Calculation Tests
const stats = calculatePortfolioStats(userPortfolio);
assertEqual(stats.totalInvested, 9000); // 2500 + 5000 + 1500
assertEqual(stats.totalClaimed, 0);
assertEqual(stats.totalPending, 7750); // 6250 + 1500

// 3. Claim Payout Tests
claimRefund('camp-103', 'GDF4...M9XZ').then((refundRes) => {
  assertEqual(refundRes.success, true);
  assertEqual(refundRes.claimedAmount, 1500);
  assertTrue(!!refundRes.txHash?.startsWith('0x'));

  // Claiming again should fail
  claimRefund('camp-103', 'GDF4...M9XZ').then((secondRes) => {
    assertEqual(secondRes.success, false);
    assertEqual(secondRes.error, 'Refund has already been claimed');
  });
});

claimReturn('camp-102', 'GDF4...M9XZ').then((returnRes) => {
  assertEqual(returnRes.success, true);
  assertEqual(returnRes.claimedAmount, 6250);
});
