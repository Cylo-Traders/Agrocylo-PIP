import React from 'react';
import type { PortfolioStats } from '../../lib/soroban/investorService';

export interface InvestorSummaryStatsProps {
  stats: PortfolioStats;
  totalCampaigns: number;
}

const cardClass =
  'rounded-campaign border border-soil-200 bg-white p-5 shadow-campaign';
const labelClass =
  'text-caption text-soil-500 block uppercase tracking-wider';
const valueClass = 'text-2xl font-bold text-soil-900 mt-1 block';

export const InvestorSummaryStats: React.FC<InvestorSummaryStatsProps> = ({
  stats,
  totalCampaigns,
}) => {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <div className={cardClass}>
        <span className={labelClass}>Funded Projects</span>
        <span className={valueClass}>{totalCampaigns}</span>
      </div>

      <div className={cardClass}>
        <span className={labelClass}>Total Contributed</span>
        <span className={valueClass}>${stats.totalInvested.toLocaleString()}</span>
      </div>

      <div className={cardClass}>
        <span className={labelClass}>Claimable / Pending</span>
        <span className={`${valueClass} text-status-harvested`}>
          ${stats.totalPending.toLocaleString()}
        </span>
      </div>

      <div className={cardClass}>
        <span className={labelClass}>Total Claimed</span>
        <span className={`${valueClass} text-status-resolved`}>
          ${stats.totalClaimed.toLocaleString()}
        </span>
      </div>
    </div>
  );
};
