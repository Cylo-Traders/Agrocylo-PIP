import React from 'react';
import type { PortfolioStats } from '../../lib/soroban/investorService';
import { StatTile } from '../analytics/StatTile';

export interface InvestorSummaryStatsProps {
  stats: PortfolioStats;
  totalCampaigns: number;
}

export const InvestorSummaryStats: React.FC<InvestorSummaryStatsProps> = ({
  stats,
  totalCampaigns,
}) => {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <StatTile label="Funded Projects" value={String(totalCampaigns)} />
      <StatTile
        label="Total Contributed"
        value={`$${stats.totalInvested.toLocaleString()}`}
      />
      <StatTile
        label="Claimable / Pending"
        value={`$${stats.totalPending.toLocaleString()}`}
      />
      <StatTile
        label="Total Claimed"
        value={`$${stats.totalClaimed.toLocaleString()}`}
      />
    </div>
  );
};
