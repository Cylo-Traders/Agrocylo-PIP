import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export { CampaignDetailPage } from './CampaignDetailPage';
export { CreateCampaignPage } from './CreateCampaignPage';
export { AdminDashboardPage } from './AdminDashboardPage';
export { ActivityFeedPage } from './ActivityFeedPage';
export { FarmerProfilePage } from './FarmerProfilePage';

// InvestorDashboardPage is the real implementation exported from ./InvestorDashboardPage
// (Issue #144: previously a placeholder was defined here with the same name, causing
// a silent shadowing bug where `import { InvestorDashboardPage } from './pages'`
// would get the placeholder instead of the real component.)
export { InvestorDashboardPage } from './InvestorDashboardPage';

type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
};

function PlaceholderPage({
  eyebrow,
  title,
  description,
  action,
}: PlaceholderPageProps) {
  return (
    <section className="mx-auto flex max-w-7xl items-center px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="w-full rounded-campaign border border-soil-200 bg-white p-8 shadow-campaign sm:p-12">
        <p className="text-label text-leaf-700">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-soil-950">{title}</h1>
        <p className="mt-4 max-w-2xl text-body text-soil-600">{description}</p>
        {action && <div className="mt-8">{action}</div>}
      </div>
    </section>
  );
}

const primaryLinkClass =
  'inline-flex rounded-lg bg-leaf-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-leaf-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2';

export function HomePage() {
  return (
    <PlaceholderPage
      eyebrow="Agricultural investment, made transparent"
      title="Fund farms. Grow communities."
      description="Discover verified agricultural campaigns and follow every milestone from funding to harvest."
      action={
        <Link to="/campaigns" className={primaryLinkClass}>
          Explore campaigns
        </Link>
      }
    />
  );
}

export function CampaignsPage() {
  return (
    <PlaceholderPage
      eyebrow="Marketplace"
      title="Campaigns"
      description="Browse active and completed agricultural funding campaigns."
      action={
        <Link to="/campaigns/new" className={primaryLinkClass}>
          Create a campaign
        </Link>
      }
    />
  );
}

export function FarmerDashboardPage() {
  return (
    <PlaceholderPage
      eyebrow="Dashboard"
      title="Farmer dashboard"
      description="Manage your campaigns, report milestones, and track funding from one place."
    />
  );
}

// ActivityFeedPage is the real implementation exported from ./ActivityFeedPage
// InvestorDashboardPage is the real implementation exported from ./InvestorDashboardPage (Issue #144)
// FarmerProfilePage is the real implementation exported from ./FarmerProfilePage

export function NotFoundPage() {
  return (
    <PlaceholderPage
      eyebrow="Error 404"
      title="Page not found"
      description="The page you requested does not exist or may have moved."
      action={
        <Link to="/" className={primaryLinkClass}>
          Return home
        </Link>
      }
    />
  );
}
