import React from 'react';
import type { PortfolioStats } from '../../lib/soroban/investorService';

export interface InvestorSummaryStatsProps {
  stats: PortfolioStats;
  totalCampaigns: number;
}

export const InvestorSummaryStats: React.FC<InvestorSummaryStatsProps> = ({
  stats,
  totalCampaigns,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="rounded-campaign border border-soil-200 bg-white p-5 shadow-campaign dark:border-soil-800 dark:bg-soil-900">
        <span className="text-label text-soil-600 dark:text-soil-400 block tracking-wider">
          Funded Projects
        </span>
        <span className="text-2xl font-bold text-soil-900 dark:text-soil-50 mt-1 block">
          {totalCampaigns}
        </span>
      </div>

      <div className="rounded-campaign border border-soil-200 bg-white p-5 shadow-campaign dark:border-soil-800 dark:bg-soil-900">
        <span className="text-label text-soil-600 dark:text-soil-400 block tracking-wider">
          Total Contributed
        </span>
        <span className="text-2xl font-bold text-soil-900 dark:text-soil-50 mt-1 block">
          ${stats.totalInvested.toLocaleString()}
        </span>
      </div>

      <div className="rounded-campaign border border-soil-200 bg-white p-5 shadow-campaign dark:border-soil-800 dark:bg-soil-900">
        <span className="text-label text-soil-600 dark:text-soil-400 block tracking-wider">
          Claimable / Pending
        </span>
        <span className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1 block">
          ${stats.totalPending.toLocaleString()}
        </span>
      </div>

      <div className="rounded-campaign border border-soil-200 bg-white p-5 shadow-campaign dark:border-soil-800 dark:bg-soil-900">
        <span className="text-label text-soil-600 dark:text-soil-400 block tracking-wider">
          Total Claimed
        </span>
        <span className="text-2xl font-bold text-leaf-700 dark:text-leaf-400 mt-1 block">
          ${stats.totalClaimed.toLocaleString()}
        </span>
      </div>
    </div>
  );
};
