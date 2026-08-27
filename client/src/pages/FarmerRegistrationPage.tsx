import { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { useFarmer } from '../hooks/contract/useRegistryQueries';
import { useRegisterFarmer } from '../hooks/contract/useRegistryMutations';
import { formatLedgerTimestamp } from '../lib/format';
import { Input } from '../components/ui/Input/Input';
import { Button } from '../components/ui/Button/Button';
import { Card } from '../components/ui/Card/Card';
import { Spinner } from '../components/ui/Spinner/Spinner';

export function FarmerRegistrationPage() {
  const { publicKey, isConnected, isConnecting, connect } = useWallet();

  if (!isConnected) {
    return (
      <section className="mx-auto flex max-w-7xl items-center px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="w-full rounded-campaign border border-soil-200 bg-white p-8 shadow-campaign sm:p-12">
          <p className="text-label text-leaf-700">Farmer Registration</p>
          <h1 className="mt-3 max-w-3xl text-soil-950">Connect your wallet</h1>
          <p className="mt-4 max-w-2xl text-body text-soil-600">
            Connect your Stellar wallet to register as a farmer or view your
            farmer profile.
          </p>
          <div className="mt-8">
            <Button
              variant="primary"
              size="lg"
              onClick={connect}
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return <ConnectedFarmerView address={publicKey!} />;
}

function ConnectedFarmerView({ address }: { address: string }) {
  const {
    data: profile,
    isLoading,
    isError,
    error,
  } = useFarmer(address);
  const [showForm, setShowForm] = useState(false);

  if (isLoading) {
    return (
      <section className="mx-auto flex max-w-7xl items-center justify-center px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <Spinner size="lg" variant="primary" />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="mx-auto flex max-w-7xl items-center px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="w-full rounded-campaign border border-soil-200 bg-white p-8 shadow-campaign sm:p-12">
          <p className="text-label text-status-disputed-dark">Error</p>
          <h1 className="mt-3 max-w-3xl text-soil-950">
            Could not load farmer data
          </h1>
          <p className="mt-4 max-w-2xl text-body text-soil-600">
            {error instanceof Error
              ? error.message
              : 'An unexpected error occurred. Please try again.'}
          </p>
        </div>
      </section>
    );
  }

  if (profile) {
    return <FarmerProfileView profile={profile} />;
  }

  // No profile found — show registration form
  if (!showForm) {
    return (
      <section className="mx-auto flex max-w-7xl items-center px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="w-full rounded-campaign border border-soil-200 bg-white p-8 shadow-campaign sm:p-12">
          <p className="text-label text-leaf-700">Farmer Registration</p>
          <h1 className="mt-3 max-w-3xl text-soil-950">
            Become a farmer on AgroCylo
          </h1>
          <p className="mt-4 max-w-2xl text-body text-soil-600">
            Register your farmer profile to start creating agricultural funding
            campaigns. You will need to provide your name and location.
          </p>
          <div className="mt-8">
            <Button
              variant="primary"
              size="lg"
              onClick={() => setShowForm(true)}
            >
              Register as Farmer
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return <FarmerRegistrationForm />;
}

function FarmerRegistrationForm() {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [nameError, setNameError] = useState('');
  const [locationError, setLocationError] = useState('');
  const registerFarmer = useRegisterFarmer();

  const validate = (): boolean => {
    let valid = true;
    if (!name.trim()) {
      setNameError('Name is required');
      valid = false;
    } else {
      setNameError('');
    }
    if (!location.trim()) {
      setLocationError('Location is required');
      valid = false;
    } else {
      setLocationError('');
    }
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    registerFarmer.mutate({ name: name.trim(), location: location.trim() });
  };

  return (
    <section className="mx-auto flex max-w-7xl items-center px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="w-full max-w-lg">
        <Card
          title="Register as Farmer"
          description="Fill in your details to create a farmer profile on the AgroCylo platform."
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Name"
              placeholder="Your full name or farm name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={nameError}
              required
              disabled={registerFarmer.isPending}
            />
            <Input
              label="Location"
              placeholder="City, region, or farm location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              error={locationError}
              required
              disabled={registerFarmer.isPending}
            />
            <div className="flex gap-3">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={registerFarmer.isPending}
              >
                {registerFarmer.isPending ? 'Registering...' : 'Register'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </section>
  );
}

function FarmerProfileView({ profile }: { profile: NonNullable<ReturnType<typeof useFarmer>['data']> }) {
  return (
    <section className="mx-auto flex max-w-7xl items-center px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="w-full max-w-lg">
        <Card
          title="Farmer Profile"
          description="Your registered farmer details on the AgroCylo platform."
        >
          <dl className="divide-y divide-soil-200">
            <div className="flex justify-between py-3">
              <dt className="text-body-sm font-medium text-soil-600">Name</dt>
              <dd className="text-body-sm font-semibold text-soil-950">
                {profile.name}
              </dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-body-sm font-medium text-soil-600">Location</dt>
              <dd className="text-body-sm font-semibold text-soil-950">
                {profile.location}
              </dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-body-sm font-medium text-soil-600">
                Registered
              </dt>
              <dd className="text-body-sm font-semibold text-soil-950">
                {formatLedgerTimestamp(profile.registration_time)}
              </dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-body-sm font-medium text-soil-600">
                Wallet Address
              </dt>
              <dd className="text-body-sm font-mono text-soil-950 break-all">
                {profile.address}
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </section>
  );
}