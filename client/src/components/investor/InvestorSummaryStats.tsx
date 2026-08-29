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
      <div className="rounded-campaign border border-soil-200 bg-white p-5 shadow-campaign">
        <span className="text-xs font-medium text-soil-500 block uppercase tracking-wider">
          Funded Projects
        </span>
        <span className="text-2xl font-bold text-soil-900 mt-1 block">
          {totalCampaigns}
        </span>
      </div>

      <div className="rounded-campaign border border-soil-200 bg-white p-5 shadow-campaign">
        <span className="text-xs font-medium text-soil-500 block uppercase tracking-wider">
          Total Contributed
        </span>
        <span className="text-2xl font-bold text-soil-900 mt-1 block">
          ${stats.totalInvested.toLocaleString()}
        </span>
      </div>

      <div className="rounded-campaign border border-soil-200 bg-white p-5 shadow-campaign">
        <span className="text-xs font-medium text-soil-500 block uppercase tracking-wider">
          Claimable / Pending
        </span>
        <span className="text-2xl font-bold text-amber-700 mt-1 block">
          ${stats.totalPending.toLocaleString()}
        </span>
      </div>

      <div className="rounded-campaign border border-soil-200 bg-white p-5 shadow-campaign">
        <span className="text-xs font-medium text-soil-500 block uppercase tracking-wider">
          Total Claimed
        </span>
        <span className="text-2xl font-bold text-leaf-700 mt-1 block">
          ${stats.totalClaimed.toLocaleString()}
        </span>
      </div>
    </div>
  );
};
