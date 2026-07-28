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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 block uppercase tracking-wider">
          Funded Projects
        </span>
        <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
          {totalCampaigns}
        </span>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 block uppercase tracking-wider">
          Total Contributed
        </span>
        <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">
          ${stats.totalInvested.toLocaleString()}
        </span>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 block uppercase tracking-wider">
          Claimable / Pending
        </span>
        <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 block">
          ${stats.totalPending.toLocaleString()}
        </span>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 block uppercase tracking-wider">
          Total Claimed
        </span>
        <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
          ${stats.totalClaimed.toLocaleString()}
        </span>
      </div>
    </div>
  );
};
