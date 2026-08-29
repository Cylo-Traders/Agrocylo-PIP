import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import {
  useFarmer,
  useFarmerCampaigns,
  useRegisterFarmer,
} from '../hooks/contract';
import { toUserFacingError } from '../lib/soroban/userFacingError';
import { isRegistryConfigured } from '../lib/soroban/config';

const cardClass =
  'rounded-campaign border border-soil-200 bg-white p-6 shadow-campaign sm:p-8';
const primaryButtonClass =
  'inline-flex items-center justify-center rounded-lg bg-leaf-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-leaf-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const inputClass =
  'w-full rounded-lg border border-soil-300 px-3 py-2 text-body-sm text-soil-900 focus:border-leaf-500 focus:outline-none focus:ring-1 focus:ring-leaf-500';
const labelClass = 'mb-1 block text-label text-soil-600';
const errorClass = 'mt-1 text-caption text-status-failed-dark';

const MAX_FIELD_LENGTH = 100;

interface RegisterFormState {
  name: string;
  location: string;
}

function stepErrors(form: RegisterFormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.name.trim().length === 0) {
    errors.name = 'Name is required.';
  } else if (form.name.trim().length > MAX_FIELD_LENGTH) {
    errors.name = `Name must be ${MAX_FIELD_LENGTH} characters or fewer.`;
  }
  if (form.location.trim().length === 0) {
    errors.location = 'Location is required.';
  } else if (form.location.trim().length > MAX_FIELD_LENGTH) {
    errors.location = `Location must be ${MAX_FIELD_LENGTH} characters or fewer.`;
  }
  return errors;
}

function formatRegistrationDate(registrationTime: bigint): string {
  return new Date(Number(registrationTime) * 1000).toLocaleDateString(
    undefined,
    { year: 'numeric', month: 'long', day: 'numeric' },
  );
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function RegisterFarmerForm({ address }: { address: string }) {
  const registerFarmer = useRegisterFarmer();
  const [form, setForm] = useState<RegisterFormState>({
    name: '',
    location: '',
  });
  const [touched, setTouched] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);

  const errors = stepErrors(form);
  const hasErrors = Object.keys(errors).length > 0;

  function update<K extends keyof RegisterFormState>(
    key: K,
    value: RegisterFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    setFlowError(null);
    if (Object.keys(stepErrors(form)).length > 0) return;

    try {
      await registerFarmer.mutateAsync({
        farmer: address,
        name: form.name.trim(),
        location: form.location.trim(),
      });
    } catch (err) {
      setFlowError(toUserFacingError(err));
    }
  }

  return (
    <div className={cardClass}>
      <p className="text-label text-leaf-700">Become a farmer</p>
      <h1 className="mt-1 text-soil-950">Register your farmer profile</h1>
      <p className="mt-2 text-body-sm text-soil-600">
        Registering associates your wallet with a public name and location so
        investors can find and trust your campaigns.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="name" className={labelClass}>
            Name
          </label>
          <input
            id="name"
            className={inputClass}
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Amina Okafor"
          />
          {touched && errors.name && (
            <p className={errorClass}>{errors.name}</p>
          )}
        </div>
        <div>
          <label htmlFor="location" className={labelClass}>
            Location
          </label>
          <input
            id="location"
            className={inputClass}
            value={form.location}
            onChange={(e) => update('location', e.target.value)}
            placeholder="Kaduna, Nigeria"
          />
          {touched && errors.location && (
            <p className={errorClass}>{errors.location}</p>
          )}
        </div>

        {flowError && <p className={errorClass}>{flowError}</p>}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={registerFarmer.isPending || (touched && hasErrors)}
            className={primaryButtonClass}
          >
            {registerFarmer.isPending
              ? 'Confirm in wallet…'
              : 'Register as a farmer'}
          </button>
        </div>
      </form>
    </div>
  );
}

function FarmerCampaignsList({ address }: { address: string }) {
  const campaignsQuery = useFarmerCampaigns(address);

  return (
    <div className={`${cardClass} mt-6`}>
      <h2 className="text-h4 text-soil-900">Campaigns</h2>

      {campaignsQuery.isLoading && (
        <p className="mt-3 text-body-sm text-soil-500">Loading campaigns…</p>
      )}

      {campaignsQuery.isError && (
        <p className="mt-3 text-body-sm text-status-failed-dark">
          Couldn&apos;t load campaigns for this address.
        </p>
      )}

      {campaignsQuery.isSuccess && campaignsQuery.data.length === 0 && (
        <p className="mt-3 text-body-sm text-soil-500">
          No campaigns registered yet.
        </p>
      )}

      {campaignsQuery.isSuccess && campaignsQuery.data.length > 0 && (
        <ul className="mt-4 divide-y divide-soil-100">
          {campaignsQuery.data.map((campaign) => (
            <li key={campaign.id.toString()} className="py-3">
              <Link
                to={`/campaigns/${campaign.id.toString()}`}
                className="font-semibold text-leaf-700 hover:text-leaf-800"
              >
                {campaign.title || `Campaign #${campaign.id.toString()}`}
              </Link>
              {campaign.description && (
                <p className="mt-1 text-body-sm text-soil-600">
                  {campaign.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProfileCard({
  name,
  location,
  address,
  registrationTime,
}: {
  name: string;
  location: string;
  address: string;
  registrationTime: bigint;
}) {
  return (
    <div className={cardClass}>
      <p className="text-label text-leaf-700">Farmer profile</p>
      <h1 className="mt-1 text-soil-950">{name}</h1>
      <dl className="mt-4 grid grid-cols-1 gap-3 text-body-sm sm:grid-cols-3">
        <div>
          <dt className="text-caption text-soil-400">Location</dt>
          <dd className="font-medium text-soil-900">{location}</dd>
        </div>
        <div>
          <dt className="text-caption text-soil-400">Registered</dt>
          <dd className="font-medium text-soil-900">
            {formatRegistrationDate(registrationTime)}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-soil-400">Wallet</dt>
          <dd className="break-all font-mono font-medium text-soil-900">
            {truncateAddress(address)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function FarmerProfilePage() {
  const wallet = useWallet();
  const params = useParams<{ address?: string }>();

  const isOwnProfile = params.address === undefined;
  const address = isOwnProfile
    ? (wallet.publicKey ?? undefined)
    : params.address;

  const farmerQuery = useFarmer(address);
  const configured = isRegistryConfigured();

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      {!isOwnProfile && (
        <Link
          to="/"
          className="mb-6 inline-block text-body-sm font-semibold text-leaf-700 hover:text-leaf-800"
        >
          ← Back
        </Link>
      )}

      {!configured && (
        <div className={cardClass}>
          <h1 className="text-h3 text-soil-950">Soroban RPC not configured</h1>
          <p className="mt-2 text-body-sm text-soil-500">
            Set <code className="font-mono">VITE_SOROBAN_RPC_URL</code> and{' '}
            <code className="font-mono">VITE_REGISTRY_CONTRACT_ID</code> to view
            or register farmer profiles.
          </p>
        </div>
      )}

      {configured && isOwnProfile && !wallet.isConnected && (
        <div className={cardClass}>
          <h1 className="text-h3 text-soil-950">Your profile</h1>
          <p className="mt-2 text-body-sm text-soil-600">
            Connect your wallet to view or register your farmer profile.
          </p>
          <button
            type="button"
            onClick={() => void wallet.connect()}
            disabled={wallet.isConnecting}
            className={`${primaryButtonClass} mt-4`}
          >
            {wallet.isConnecting ? 'Connecting…' : 'Connect wallet'}
          </button>
        </div>
      )}

      {configured && address && farmerQuery.isLoading && (
        <div className={cardClass}>
          <p className="text-body-sm text-soil-500">Loading profile…</p>
        </div>
      )}

      {configured && address && farmerQuery.isError && (
        <div className={cardClass}>
          <p className="text-body-sm text-status-failed-dark">
            Couldn&apos;t load this profile. Try reloading the page.
          </p>
        </div>
      )}

      {configured && address && farmerQuery.isSuccess && (
        <>
          {farmerQuery.data ? (
            <ProfileCard
              name={farmerQuery.data.name}
              location={farmerQuery.data.location}
              address={farmerQuery.data.address}
              registrationTime={farmerQuery.data.registration_time}
            />
          ) : isOwnProfile ? (
            <RegisterFarmerForm address={address} />
          ) : (
            <div className={cardClass}>
              <h1 className="text-h3 text-soil-950">Not registered</h1>
              <p className="mt-2 text-body-sm text-soil-600">
                This address hasn&apos;t registered a farmer profile yet.
              </p>
            </div>
          )}

          <FarmerCampaignsList address={address} />
        </>
      )}
    </section>
  );
}

export default FarmerProfilePage;
