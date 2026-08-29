import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Playground } from './components/ui/Playground';
import { AppLayout } from './components/AppLayout';
import DesignFoundationsPage from './pages/DesignFoundationsPage';
import { AnalyticsDashboardPage } from './pages/AnalyticsDashboardPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { ActivityFeedPage } from './pages/ActivityFeedPage';
import { CampaignDetailPage } from './pages/CampaignDetailPage';
import { CreateCampaignPage } from './pages/CreateCampaignPage';
import { InvestorDashboardPage } from './pages/InvestorDashboardPage';
import {
  FarmerProfilePage,
  CampaignsPage,
  FarmerDashboardPage,
  NotFoundPage,
} from './pages';
import './App.css';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentRoute(window.location.hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  if (currentRoute === '#dev-components') {
    return (
      <div>
        <nav className="ui-playground-nav">
          <button
            type="button"
            onClick={() => {
              window.location.hash = '';
            }}
            className="ui-playground-back-link-btn"
          >
            &larr; Back to App Landing
          </button>
        </nav>
        <Playground />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<DesignFoundationsPage />} />
      <Route path="/analytics" element={<AnalyticsDashboardPage />} />
      <Route path="/dev/components" element={<Playground />} />

      {/* AppLayout routes — all pages wired into the router (Issue #143) */}
      <Route element={<AppLayout />}>
        <Route path="/activity" element={<ActivityFeedPage />} />

        {/* Campaign routes */}
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/campaigns/new" element={<CreateCampaignPage />} />
        <Route path="/campaigns/:id" element={<CampaignDetailPage />} />

        {/* Dashboard routes */}
        <Route path="/dashboard/investor" element={<InvestorDashboardPage />} />
        <Route path="/dashboard/farmer" element={<FarmerDashboardPage />} />
        <Route path="/dashboard/admin" element={<AdminDashboardPage />} />

        {/* Profile routes */}
        <Route path="/profile" element={<FarmerProfilePage />} />
        <Route path="/farmers/:address" element={<FarmerProfilePage />} />

        {/* Catch-all 404 route (Issue #143) */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
