import { useWallet, truncateAddress } from '../context/WalletContext';

export default function Header() {
  const {
    publicKey,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    clearError,
  } = useWallet();

  return (
    <nav className="relative flex flex-wrap items-center justify-between gap-3 rounded-campaign border border-soil-200 bg-white px-6 py-3 shadow-campaign">
      <div className="flex items-center gap-2">
        <span className="text-h4 font-bold text-soil-900">Agrocylo</span>
        <span className="text-label text-soil-600">PIP</span>
      </div>

      <div className="flex items-center gap-3">
        {isConnected && publicKey ? (
          <>
            <span className="rounded-lg bg-leaf-50 px-3 py-1.5 font-mono text-body-sm text-leaf-700">
              {truncateAddress(publicKey)}
            </span>
            <button
              type="button"
              onClick={disconnect}
              className="rounded-lg border border-soil-300 bg-white px-4 py-1.5 text-body-sm font-semibold text-soil-700 transition-colors hover:bg-soil-50"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={isConnecting}
            className="rounded-lg bg-leaf-600 px-4 py-1.5 text-body-sm font-semibold text-white transition-colors hover:bg-leaf-700 disabled:opacity-50"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="absolute inset-x-4 top-full z-50 mt-2 w-auto max-w-sm rounded-lg border border-status-disputed/20 bg-status-disputed-light p-3 text-body-sm text-status-disputed-dark shadow-lg sm:inset-x-auto sm:right-6"
        >
          {error}
          <button
            type="button"
            onClick={clearError}
            className="ml-2 font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </nav>
  );
}
