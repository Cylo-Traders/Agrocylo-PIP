import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { useCampaignAnalytics } from '../hooks/useCampaignAnalytics';
import { ChartCard } from '../components/analytics/ChartCard';
import { ComingSoonCard } from '../components/analytics/ComingSoonCard';
import { StatTile } from '../components/analytics/StatTile';
import { FundingVolumeChart } from '../components/analytics/FundingVolumeChart';
import { CampaignsByStatusChart } from '../components/analytics/CampaignsByStatusChart';
import { FundingOutcomeChart } from '../components/analytics/FundingOutcomeChart';
import { CampaignSizeChart } from '../components/analytics/CampaignSizeChart';
import { ChartsGridSkeleton } from '../components/ui/Skeleton/Skeleton';

const numberFormatter = new Intl.NumberFormat('en-US', { notation: 'compact' });
const percentFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
});

function DashboardHeader() {
  return (
    <header className="mb-8">
      <Link
        to="/"
        className="text-body-sm font-semibold text-leaf-700 hover:text-leaf-800"
      >
        ← Back
      </Link>
      <p className="mt-4 text-label text-leaf-700">
        Analytics &amp; price discovery
      </p>
      <h1 className="mt-3 text-soil-950">Platform analytics</h1>
      <p className="mt-3 max-w-2xl text-body text-soil-600">
        Funding trends, campaign outcomes, and pricing signals derived from
        ProductionEscrowContract activity.
      </p>
    </header>
  );
}

function ComingSoonSection() {
  return (
    <section className="mt-6 grid gap-6 sm:grid-cols-2">
      <ComingSoonCard
        title="Regional pricing insights"
        description="Regional commodity pricing isn't recorded on-chain yet. This panel will populate once a pricing data source (backend analytics endpoint or an oracle feed) is available."
      />
      <ComingSoonCard
        title="Demand vs. supply signals"
        description="Comparing investor demand against farmer-side supply requires aggregated backend analytics that don't exist yet. Coming once those endpoints ship."
      />
    </section>
  );
}

function NotConfiguredNotice() {
  return (
    <div className="mb-6 rounded-campaign border border-amber-300 bg-amber-50 p-5 sm:p-6">
      <h2 className="text-h4 text-amber-900">Soroban RPC not configured</h2>
      <p className="mt-2 text-body-sm text-amber-800">
        This dashboard reads ProductionEscrowContract events directly from
        Soroban RPC. Set{' '}
        <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
          VITE_SOROBAN_RPC_URL
        </code>{' '}
        and{' '}
        <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
          VITE_PRODUCTION_ESCROW_CONTRACT_ID
        </code>{' '}
        (see{' '}
        <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
          client/.env.example
        </code>
        ) to a deployed contract to see live charts below.
      </p>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="mb-6 rounded-campaign border border-status-failed/30 bg-status-failed-light p-5 sm:p-6">
      <h2 className="text-h4 text-status-failed-dark">
        Couldn&apos;t load analytics data
      </h2>
      <p className="mt-2 text-body-sm text-status-failed-dark">{message}</p>
    </div>
  );
}

export function AnalyticsDashboardPage() {
  const analytics = useCampaignAnalytics();
  const isConfigured = analytics.status !== 'not-configured';

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <Header />
      <DashboardHeader />

      {analytics.status === 'not-configured' && <NotConfiguredNotice />}
      {analytics.status === 'error' && (
        <ErrorNotice message={analytics.message} />
      )}
      {analytics.status === 'loading' && <ChartsGridSkeleton />}

      {analytics.status === 'ready' && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile
              label="Campaigns tracked"
              value={numberFormatter.format(analytics.metrics.totalCampaigns)}
            />
            <StatTile
              label="Total funding volume"
              value={numberFormatter.format(analytics.metrics.totalVolume)}
              sublabel="contract units"
            />
            <StatTile
              label="Avg. campaign size"
              value={numberFormatter.format(
                analytics.metrics.averageCampaignSize,
              )}
              sublabel="contract units"
            />
            <StatTile
              label="Funding success rate"
              value={`${percentFormatter.format(analytics.metrics.fundingSuccessRatePercent)}%`}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ChartCard
              title="Funding volume over time"
              description="Daily contribution volume across all campaigns."
              className="lg:col-span-2"
            >
              <FundingVolumeChart
                data={analytics.metrics.fundingVolumeOverTime}
              />
            </ChartCard>

            <ChartCard
              title="Campaigns by status"
              description="Current lifecycle stage of every tracked campaign."
            >
              <CampaignsByStatusChart
                data={analytics.metrics.campaignsByStatus}
              />
            </ChartCard>

            <ChartCard
              title="Funding outcome"
              description="Share of campaigns that reached their funding target."
            >
              <FundingOutcomeChart data={analytics.metrics.fundingOutcome} />
            </ChartCard>

            <ChartCard
              title="Campaign size distribution"
              description="Number of campaigns by funding target range."
              className="lg:col-span-2"
            >
              <CampaignSizeChart
                data={analytics.metrics.campaignSizeDistribution}
              />
            </ChartCard>
          </div>
        </>
      )}

      {!isConfigured && (
        <div className="grid gap-6 opacity-60 lg:grid-cols-2">
          <ChartCard title="Funding volume over time" className="lg:col-span-2">
            <FundingVolumeChart data={[]} />
          </ChartCard>
          <ChartCard title="Campaigns by status">
            <CampaignsByStatusChart data={[]} />
          </ChartCard>
          <ChartCard title="Funding outcome">
            <FundingOutcomeChart data={[]} />
          </ChartCard>
        </div>
      )}

      <ComingSoonSection />
    </section>
  );
}
