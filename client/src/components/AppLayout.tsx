import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

const navigation = [
  { label: 'Home', to: '/', end: true },
  { label: 'Campaigns', to: '/campaigns' },
  { label: 'Farmer', to: '/dashboard/farmer' },
  { label: 'Investor', to: '/dashboard/investor' },
  { label: 'Admin', to: '/dashboard/admin' },
  { label: 'Activity', to: '/activity' },
  { label: 'Profile', to: '/profile' },
];

function Logo() {
  return (
    <Link
      to="/"
      className="flex shrink-0 items-center gap-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500"
      aria-label="AgroCylo home"
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf-700 text-white"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 21V9" strokeLinecap="round" />
          <path
            d="M12 13C8 13 5 10.5 5 7c4 0 7 2.5 7 6Z"
            strokeLinejoin="round"
          />
          <path
            d="M12 17c4 0 7-2.5 7-6-4 0-7 2.5-7 6Z"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-lg font-bold tracking-tight text-soil-950">
        AgroCylo
      </span>
    </Link>
  );
}

function NavigationLinks({ mobile = false }: { mobile?: boolean }) {
  return (
    <>
      {navigation.map(({ label, to, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            [
              'rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500',
              mobile ? 'block px-3 py-2.5 text-base' : 'px-2.5 py-2 text-sm',
              isActive
                ? 'bg-leaf-100 text-leaf-800'
                : 'text-soil-600 hover:bg-soil-100 hover:text-soil-950',
            ].join(' ')
          }
        >
          {label}
        </NavLink>
      ))}
    </>
  );
}

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close the mobile nav when the route changes; menuOpen is local UI state, not derived data.
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-soil-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Logo />

          <nav
            className="ml-auto hidden items-center gap-1 lg:flex"
            aria-label="Primary navigation"
          >
            <NavigationLinks />
          </nav>

          <button
            type="button"
            className="ml-auto hidden rounded-lg bg-leaf-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-leaf-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2 sm:block lg:ml-3"
            onClick={() => undefined}
          >
            Connect wallet
          </button>

          <button
            type="button"
            className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-lg text-soil-700 hover:bg-soil-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={
              menuOpen ? 'Close navigation menu' : 'Open navigation menu'
            }
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              {menuOpen ? (
                <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <nav
            id="mobile-navigation"
            className="border-t border-soil-200 bg-white px-4 py-4 lg:hidden"
            aria-label="Mobile navigation"
          >
            <div className="mx-auto max-w-7xl space-y-1">
              <NavigationLinks mobile />
              <button
                type="button"
                className="mt-3 w-full rounded-lg bg-leaf-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-leaf-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 sm:hidden"
                onClick={() => undefined}
              >
                Connect wallet
              </button>
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-soil-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-soil-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} AgroCylo. Growing shared prosperity.
          </p>
          <Link
            className="font-medium text-leaf-700 hover:text-leaf-800"
            to="/activity"
          >
            View platform activity
          </Link>
        </div>
      </footer>
    </div>
  );
}
