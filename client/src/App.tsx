import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Playground } from './components/ui/Playground';
import DesignFoundationsPage from './pages/DesignFoundationsPage';
import { AnalyticsDashboardPage } from './pages/AnalyticsDashboardPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
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
      <Route path="/admin" element={<AdminDashboardPage />} />
      <Route path="/dev/components" element={<Playground />} />
    </Routes>
  );
}
