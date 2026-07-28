import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { StrKey } from '@stellar/stellar-sdk';
import Header from '../components/Header';
import { useWallet } from '../context/WalletContext';
import { useCreateCampaign, useRegisterCampaign } from '../hooks/contract';
import { toUserFacingError } from '../lib/soroban/userFacingError';
import {
  CONTRACT_SYMBOL_HINT,
  isValidContractSymbol,
} from '../lib/soroban/symbol';
import {
  isEscrowConfigured,
  isRegistryConfigured,
} from '../lib/soroban/config';

const cardClass =
  'rounded-campaign border border-soil-200 bg-white p-6 shadow-campaign sm:p-8';
const primaryButtonClass =
  'inline-flex items-center justify-center rounded-lg bg-leaf-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-leaf-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-lg border border-soil-300 px-5 py-2.5 text-sm font-semibold text-soil-700 transition-colors hover:bg-soil-50 disabled:cursor-not-allowed disabled:opacity-50';
const inputClass =
  'w-full rounded-lg border border-soil-300 px-3 py-2 text-body-sm text-soil-900 focus:border-leaf-500 focus:outline-none focus:ring-1 focus:ring-leaf-500';
const labelClass = 'mb-1 block text-label text-soil-600';
const errorClass = 'mt-1 text-caption text-status-failed-dark';
const hintClass = 'mt-1 text-caption text-soil-600';

const STEPS = ['Campaign details', 'Funding', 'Deadline', 'Review'];

interface FormState {
  title: string;
  description: string;
  harvestMetadata: string;
  targetAmount: string;
  tokenAddress: string;
  deadline: string;
}

const initialState: FormState = {
  title: '',
  description: '',
  harvestMetadata: '',
  targetAmount: '',
  tokenAddress: '',
  deadline: '',
};

function generateCampaignId(): bigint {
  return BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
}

function stepErrors(step: number, form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};

  if (step === 0) {
    if (form.title.trim().length === 0) errors.title = 'Title is required.';
    if (form.description.trim().length === 0)
      errors.description = 'Description is required.';
    if (form.harvestMetadata.length === 0) {
      errors.harvestMetadata = 'Harvest metadata tag is required.';
    } else if (!isValidContractSymbol(form.harvestMetadata)) {
      errors.harvestMetadata = CONTRACT_SYMBOL_HINT;
    }
  }

  if (step === 1) {
    if (
      form.targetAmount.length === 0 ||
      !/^\d+$/.test(form.targetAmount) ||
      BigInt(form.targetAmount) <= 0n
    ) {
      errors.targetAmount = 'Enter a whole number greater than zero.';
    }
    if (
      form.tokenAddress.length === 0 ||
      !StrKey.isValidContract(form.tokenAddress)
    ) {
      errors.tokenAddress = 'Enter a valid token contract address (C...).';
    }
  }

  if (step === 2) {
    if (form.deadline.length === 0) {
      errors.deadline = 'Deadline is required.';
    } else if (new Date(form.deadline).getTime() <= Date.now()) {
      errors.deadline = 'Deadline must be in the future.';
    }
  }

  return errors;
}

export function CreateCampaignPage() {
  const wallet = useWallet();
  const navigate = useNavigate();
  const createCampaign = useCreateCampaign();
  const registerCampaign = useRegisterCampaign();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialState);
  const [touched, setTouched] = useState(false);
  const [campaignId, setCampaignId] = useState<bigint | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);

  const configured = isEscrowConfigured() && isRegistryConfigured();
  const errors = stepErrors(step, form);
  const hasErrors = Object.keys(errors).length > 0;
  const isSubmitting = createCampaign.isPending || registerCampaign.isPending;
  const campaignCreated = campaignId !== null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function goNext(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (Object.keys(stepErrors(step, form)).length > 0) return;
    setTouched(false);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setTouched(false);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleConfirm() {
    if (!wallet.publicKey) return;
    setFlowError(null);
    try {
      let id = campaignId;
      if (id === null) {
        id = generateCampaignId();
        await createCampaign.mutateAsync({
          campaignId: id,
          farmer: wallet.publicKey,
          targetAmount: BigInt(form.targetAmount),
          tokenAddress: form.tokenAddress,
          deadline: BigInt(
            Math.floor(new Date(form.deadline).getTime() / 1000),
          ),
          harvestMetadata: form.harvestMetadata,
        });
        setCampaignId(id);
      }

      await registerCampaign.mutateAsync({
        campaignId: id,
        farmer: wallet.publicKey,
        title: form.title,
        description: form.description,
      });

      navigate(`/campaigns/${id.toString()}`);
    } catch (err) {
      setFlowError(toUserFacingError(err));
    }
  }

  if (!configured) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <Header />
        <div className={`${cardClass} mt-8`}>
          <h1 className="text-h3 text-soil-950">Soroban RPC not configured</h1>
          <p className="mt-2 text-body-sm text-soil-600">
            Set <code className="font-mono">VITE_SOROBAN_RPC_URL</code>,{' '}
            <code className="font-mono">
              VITE_PRODUCTION_ESCROW_CONTRACT_ID
            </code>
            , and <code className="font-mono">VITE_REGISTRY_CONTRACT_ID</code>{' '}
            to create campaigns.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <Header />

      <div className="mb-8 mt-6">
        <p className="text-label text-leaf-700">For farmers</p>
        <h1 className="mt-1 text-soil-950">Create a campaign</h1>
        <p className="mt-2 text-body-sm text-soil-600">
          Tell investors about your farm, funding goal, timeline, and expected
          harvest.
        </p>
      </div>

      {!wallet.isConnected ? (
        <div className={cardClass}>
          <p className="text-body-sm text-soil-600">
            Connect your wallet to create a campaign — you&apos;ll be the farmer
            of record for it.
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
      ) : (
        <div className={cardClass}>
          <ol className="mb-6 flex items-center gap-2" aria-label="Form steps">
            {STEPS.map((label, index) => (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    index === step
                      ? 'bg-leaf-700 text-white'
                      : index < step
                        ? 'bg-leaf-100 text-leaf-700'
                        : 'bg-soil-100 text-soil-600'
                  }`}
                  aria-current={index === step ? 'step' : undefined}
                  aria-label={`Step ${index + 1} of ${STEPS.length}: ${label}${
                    index === step
                      ? ' (current)'
                      : index < step
                        ? ' (completed)'
                        : ''
                  }`}
                >
                  {index + 1}
                </span>
                <span
                  aria-hidden="true"
                  className={`hidden text-caption sm:inline ${index === step ? 'font-semibold text-soil-900' : 'text-soil-600'}`}
                >
                  {label}
                </span>
                {index < STEPS.length - 1 && (
                  <span
                    className="h-px flex-1 bg-soil-200"
                    aria-hidden="true"
                  />
                )}
              </li>
            ))}
          </ol>

          {step === 0 && (
            <form onSubmit={goNext} className="space-y-4">
              <div>
                <label htmlFor="title" className={labelClass}>
                  Title
                </label>
                <input
                  id="title"
                  className={inputClass}
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="Highland maize expansion"
                  aria-invalid={touched && !!errors.title}
                  aria-describedby={
                    touched && errors.title ? 'title-error' : undefined
                  }
                />
                {touched && errors.title && (
                  <p id="title-error" role="alert" className={errorClass}>
                    {errors.title}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="description" className={labelClass}>
                  Description
                </label>
                <textarea
                  id="description"
                  rows={4}
                  className={inputClass}
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  placeholder="What you're growing, where, and how the funds will be used."
                  aria-invalid={touched && !!errors.description}
                  aria-describedby={
                    touched && errors.description
                      ? 'description-error'
                      : undefined
                  }
                />
                {touched && errors.description && (
                  <p id="description-error" role="alert" className={errorClass}>
                    {errors.description}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="harvestMetadata" className={labelClass}>
                  Harvest metadata tag
                </label>
                <input
                  id="harvestMetadata"
                  className={inputClass}
                  value={form.harvestMetadata}
                  onChange={(e) => update('harvestMetadata', e.target.value)}
                  placeholder="maize_2026"
                  aria-invalid={touched && !!errors.harvestMetadata}
                  aria-describedby="harvestMetadata-hint"
                />
                <p
                  id="harvestMetadata-hint"
                  role={touched && errors.harvestMetadata ? 'alert' : undefined}
                  className={hintClass}
                >
                  {touched && errors.harvestMetadata
                    ? errors.harvestMetadata
                    : `Short on-chain crop/season tag. ${CONTRACT_SYMBOL_HINT}`}
                </p>
              </div>
              <div className="flex justify-end pt-2">
                <button type="submit" className={primaryButtonClass}>
                  Next
                </button>
              </div>
            </form>
          )}

          {step === 1 && (
            <form onSubmit={goNext} className="space-y-4">
              <div>
                <label htmlFor="targetAmount" className={labelClass}>
                  Funding target (contract units)
                </label>
                <input
                  id="targetAmount"
                  inputMode="numeric"
                  className={inputClass}
                  value={form.targetAmount}
                  onChange={(e) => update('targetAmount', e.target.value)}
                  placeholder="50000"
                  aria-invalid={touched && !!errors.targetAmount}
                  aria-describedby={
                    touched && errors.targetAmount
                      ? 'targetAmount-error'
                      : undefined
                  }
                />
                {touched && errors.targetAmount && (
                  <p
                    id="targetAmount-error"
                    role="alert"
                    className={errorClass}
                  >
                    {errors.targetAmount}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="tokenAddress" className={labelClass}>
                  Funding token address
                </label>
                <input
                  id="tokenAddress"
                  className={`${inputClass} font-mono`}
                  value={form.tokenAddress}
                  onChange={(e) => update('tokenAddress', e.target.value)}
                  placeholder="C..."
                  aria-invalid={touched && !!errors.tokenAddress}
                  aria-describedby={
                    touched && errors.tokenAddress
                      ? 'tokenAddress-error'
                      : undefined
                  }
                />
                {touched && errors.tokenAddress && (
                  <p
                    id="tokenAddress-error"
                    role="alert"
                    className={errorClass}
                  >
                    {errors.tokenAddress}
                  </p>
                )}
              </div>
              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={goBack}
                  className={secondaryButtonClass}
                >
                  Back
                </button>
                <button type="submit" className={primaryButtonClass}>
                  Next
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={goNext} className="space-y-4">
              <div>
                <label htmlFor="deadline" className={labelClass}>
                  Funding deadline
                </label>
                <input
                  id="deadline"
                  type="datetime-local"
                  className={inputClass}
                  value={form.deadline}
                  onChange={(e) => update('deadline', e.target.value)}
                  aria-invalid={touched && !!errors.deadline}
                  aria-describedby={
                    touched && errors.deadline ? 'deadline-error' : undefined
                  }
                />
                {touched && errors.deadline && (
                  <p id="deadline-error" role="alert" className={errorClass}>
                    {errors.deadline}
                  </p>
                )}
              </div>
              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={goBack}
                  className={secondaryButtonClass}
                >
                  Back
                </button>
                <button type="submit" className={primaryButtonClass}>
                  Next
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <dl className="divide-y divide-soil-100 border-t border-soil-100 text-body-sm">
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-soil-600">Title</dt>
                  <dd className="text-right font-medium text-soil-900">
                    {form.title}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-soil-600">Description</dt>
                  <dd className="max-w-xs text-right text-soil-700">
                    {form.description}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-soil-600">Harvest tag</dt>
                  <dd className="font-medium text-soil-900">
                    {form.harvestMetadata}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-soil-600">Target</dt>
                  <dd className="font-medium text-soil-900">
                    {form.targetAmount}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-soil-600">Token</dt>
                  <dd className="max-w-xs truncate text-right font-mono text-soil-700">
                    {form.tokenAddress}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-soil-600">Deadline</dt>
                  <dd className="font-medium text-soil-900">
                    {new Date(form.deadline).toLocaleString()}
                  </dd>
                </div>
              </dl>

              {campaignCreated && (
                <p
                  role="status"
                  className="rounded-lg bg-status-active-light px-3 py-2 text-body-sm text-status-active-dark"
                >
                  Campaign #{campaignId!.toString()} was created on-chain.
                  Retrying will only complete registry registration.
                </p>
              )}

              {flowError && (
                <p
                  role="alert"
                  className="text-body-sm text-status-failed-dark"
                >
                  {flowError}
                </p>
              )}

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={isSubmitting || campaignCreated}
                  className={secondaryButtonClass}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={isSubmitting || hasErrors}
                  className={primaryButtonClass}
                >
                  {createCampaign.isPending
                    ? 'Confirm in wallet (1 of 2)…'
                    : registerCampaign.isPending
                      ? 'Confirm in wallet (2 of 2)…'
                      : campaignCreated
                        ? 'Retry registration'
                        : 'Create campaign'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
