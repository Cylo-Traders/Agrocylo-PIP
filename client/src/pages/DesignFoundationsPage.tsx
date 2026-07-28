import { Link } from 'react-router-dom';
import Header from '../components/Header';

const STATUS_MAP = {
  Active: {
    bg: 'bg-status-active',
    bgLight: 'bg-status-active-light',
    text: 'text-status-active-dark',
    border: 'border-status-active/20',
  },
  Funding: {
    bg: 'bg-status-funding',
    bgLight: 'bg-status-funding-light',
    text: 'text-status-funding-dark',
    border: 'border-status-funding/20',
  },
  Funded: {
    bg: 'bg-status-funded',
    bgLight: 'bg-status-funded-light',
    text: 'text-status-funded-dark',
    border: 'border-status-funded/20',
  },
  InProduction: {
    bg: 'bg-status-inproduction',
    bgLight: 'bg-status-inproduction-light',
    text: 'text-status-inproduction-dark',
    border: 'border-status-inproduction/20',
  },
  Harvested: {
    bg: 'bg-status-harvested',
    bgLight: 'bg-status-harvested-light',
    text: 'text-status-harvested-dark',
    border: 'border-status-harvested/20',
  },
  Disputed: {
    bg: 'bg-status-disputed',
    bgLight: 'bg-status-disputed-light',
    text: 'text-status-disputed-dark',
    border: 'border-status-disputed/20',
  },
  Resolved: {
    bg: 'bg-status-resolved',
    bgLight: 'bg-status-resolved-light',
    text: 'text-status-resolved-dark',
    border: 'border-status-resolved/20',
  },
  Settled: {
    bg: 'bg-status-settled',
    bgLight: 'bg-status-settled-light',
    text: 'text-status-settled-dark',
    border: 'border-status-settled/20',
  },
  Failed: {
    bg: 'bg-status-failed',
    bgLight: 'bg-status-failed-light',
    text: 'text-status-failed-dark',
    border: 'border-status-failed/20',
  },
} as const;

const PALETTE_SHADES = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const;

const PALETTE_MAP: Record<string, Record<number, string>> = {
  soil: {
    50: 'bg-soil-50',
    100: 'bg-soil-100',
    200: 'bg-soil-200',
    300: 'bg-soil-300',
    400: 'bg-soil-400',
    500: 'bg-soil-500',
    600: 'bg-soil-600',
    700: 'bg-soil-700',
    800: 'bg-soil-800',
    900: 'bg-soil-900',
    950: 'bg-soil-950',
  },
  leaf: {
    50: 'bg-leaf-50',
    100: 'bg-leaf-100',
    200: 'bg-leaf-200',
    300: 'bg-leaf-300',
    400: 'bg-leaf-400',
    500: 'bg-leaf-500',
    600: 'bg-leaf-600',
    700: 'bg-leaf-700',
    800: 'bg-leaf-800',
    900: 'bg-leaf-900',
    950: 'bg-leaf-950',
  },
  amber: {
    50: 'bg-amber-50',
    100: 'bg-amber-100',
    200: 'bg-amber-200',
    300: 'bg-amber-300',
    400: 'bg-amber-400',
    500: 'bg-amber-500',
    600: 'bg-amber-600',
    700: 'bg-amber-700',
    800: 'bg-amber-800',
    900: 'bg-amber-900',
    950: 'bg-amber-950',
  },
  bark: {
    50: 'bg-bark-50',
    100: 'bg-bark-100',
    200: 'bg-bark-200',
    300: 'bg-bark-300',
    400: 'bg-bark-400',
    500: 'bg-bark-500',
    600: 'bg-bark-600',
    700: 'bg-bark-700',
    800: 'bg-bark-800',
    900: 'bg-bark-900',
    950: 'bg-bark-950',
  },
};

function StatusBadge({ label }: { label: keyof typeof STATUS_MAP }) {
  const s = STATUS_MAP[label];
  return (
    <span className={`status-badge ${s.bgLight} ${s.text}`}>
      <span className={`h-2 w-2 rounded-full ${s.bg}`} />
      {label}
    </span>
  );
}

function DesignFoundationsPage() {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <Header />

      {/* ── Headings & Typography scale ── */}
      <header className="mb-12 mt-8 text-center">
        <p className="text-label text-soil-600">Agrocylo PIP</p>
        <h1 className="mt-2 text-soil-950">Design Foundations</h1>
        <p className="mt-3 text-body text-soil-600">
          Tailwind CSS utility classes — palette, status tokens, and typographic
          scale.
        </p>
        <Link
          to="/analytics"
          className="mt-4 inline-flex text-body-sm font-semibold text-leaf-700 hover:text-leaf-800"
        >
          View analytics dashboard →
        </Link>
        <Link
          to="/admin"
          className="mt-4 inline-flex text-body-sm font-semibold text-leaf-700 hover:text-leaf-800"
        >
          View admin dashboard →
        </Link>
      </header>

      {/* ── Typography scale ── */}
      <section className="mb-12 rounded-campaign border border-soil-200 bg-white p-8 shadow-campaign">
        <h2 className="text-soil-900">Typography Scale</h2>
        <p className="mt-2 text-body-sm text-soil-600">
          Headings, body, and caption sizes.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <p className="text-caption text-soil-600">.text-h1</p>
            <h1 className="text-soil-950">The quick brown fox</h1>
          </div>
          <div>
            <p className="text-caption text-soil-600">.text-h2</p>
            <h2 className="text-soil-900">The quick brown fox</h2>
          </div>
          <div>
            <p className="text-caption text-soil-600">.text-h3</p>
            <h3 className="text-soil-900">The quick brown fox</h3>
          </div>
          <div>
            <p className="text-caption text-soil-600">.text-h4</p>
            <h4 className="text-soil-900">The quick brown fox</h4>
          </div>
          <div>
            <p className="text-caption text-soil-600">.text-body</p>
            <p className="text-body text-soil-700">
              Body text used for paragraphs, descriptions, and general content.
            </p>
          </div>
          <div>
            <p className="text-caption text-soil-600">.text-body-sm</p>
            <p className="text-body-sm text-soil-600">
              Smaller body text for secondary information and metadata.
            </p>
          </div>
          <div>
            <p className="text-caption text-soil-600">.text-caption</p>
            <p className="text-caption text-soil-600">
              Caption text for labels, timestamps, and auxiliary content.
            </p>
          </div>
          <div>
            <p className="text-caption text-soil-600">.text-label</p>
            <p className="text-label text-soil-600">Label / Overline</p>
          </div>
        </div>
      </section>

      {/* ── Campaign Status Colors ── */}
      <section className="rounded-campaign border border-soil-200 bg-white p-8 shadow-campaign">
        <h2 className="text-soil-900">Campaign Status Tokens</h2>
        <p className="mt-2 text-body-sm text-soil-600">
          Each campaign lifecycle status has a dedicated color token (see{' '}
          <code className="rounded bg-soil-100 px-1 py-0.5 font-mono text-xs text-soil-700">
            tailwind.config.ts
          </code>
          ).
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {(Object.keys(STATUS_MAP) as (keyof typeof STATUS_MAP)[]).map(
            (status) => {
              const c = STATUS_MAP[status];
              return (
                <div
                  key={status}
                  className={`flex items-center justify-between rounded-lg ${c.bgLight} ${c.border} border px-4 py-3`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.bg} text-xs font-bold text-white`}
                    >
                      {status[0]}
                    </div>
                    <span className="text-body font-semibold text-soil-900">
                      {status}
                    </span>
                  </div>
                  <StatusBadge label={status} />
                </div>
              );
            },
          )}
        </div>

        <div className="mt-8 rounded-lg bg-soil-50 p-5">
          <p className="text-label text-soil-600">Usage Example</p>
          <p className="mt-2 text-body-sm text-soil-700">
            Use{' '}
            <code className="rounded bg-soil-200 px-1.5 py-0.5 font-mono text-xs text-soil-800">
              bg-status-active
            </code>
            ,{' '}
            <code className="rounded bg-soil-200 px-1.5 py-0.5 font-mono text-xs text-soil-800">
              text-status-active
            </code>
            , or{' '}
            <code className="rounded bg-soil-200 px-1.5 py-0.5 font-mono text-xs text-soil-800">
              bg-status-active-light
            </code>{' '}
            in your Tailwind classes to apply status colors consistently.
          </p>
        </div>
      </section>

      {/* ── Earth-Tone Palette ── */}
      <section className="mt-12 rounded-campaign border border-soil-200 bg-white p-8 shadow-campaign">
        <h2 className="text-soil-900">Earth-Tone Palette</h2>
        <p className="mt-2 text-body-sm text-soil-600">
          Soil, leaf, amber, and bark scales for the agricultural theme.
        </p>

        {(Object.keys(PALETTE_MAP) as (keyof typeof PALETTE_MAP)[]).map(
          (palette) => (
            <div key={palette} className="mt-5">
              <p className="text-caption font-semibold text-soil-600 capitalize">
                {palette}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {PALETTE_SHADES.map((shade) => (
                  <div key={shade} className="flex flex-col items-center">
                    <div
                      className={`h-8 w-8 rounded ${PALETTE_MAP[palette][shade]}`}
                      title={`${palette}-${shade}`}
                      aria-hidden="true"
                    />
                    <span className="mt-0.5 text-[10px] leading-3 text-soil-600">
                      {shade}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ),
        )}
      </section>

      <footer className="mt-12 border-t border-soil-200 pt-6 text-center">
        <p className="text-caption text-soil-600">
          Agrocylo PIP — Design Foundations
        </p>
      </footer>
    </div>
  );
}

export default DesignFoundationsPage;
