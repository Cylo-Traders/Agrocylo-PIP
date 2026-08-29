import React, { useState, useId } from 'react';
import { ActivityFeed } from '../components/campaign/ActivityFeed';

/**
 * Global platform activity feed. Accepts a comma-separated list of campaign
 * IDs from an input (or reads from VITE_KNOWN_CAMPAIGN_IDS env) so the feed
 * can aggregate across multiple campaigns. When only one ID is entered, the
 * feed is scoped to that campaign.
 */

function parseCampaignIds(raw: string): bigint[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s) => {
      try {
        return [BigInt(s)];
      } catch {
        return [];
      }
    });
}

const envIds: bigint[] = parseCampaignIds(
  import.meta.env.VITE_KNOWN_CAMPAIGN_IDS ?? '',
);

export function ActivityFeedPage() {
  const [inputValue, setInputValue] = useState('');
  const [submitted, setSubmitted] = useState('');
  const inputId = useId();

  const campaignIds: bigint[] = submitted.trim()
    ? parseCampaignIds(submitted)
    : envIds;

  const scoped = campaignIds.length === 1 ? campaignIds[0] : undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(inputValue);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: 'var(--color-leaf-700, #15803d)' }}
        >
          Platform updates
        </p>
        <h1
          className="mt-1 text-2xl font-bold"
          style={{ color: 'var(--color-soil-950, #0c0a09)' }}
        >
          Activity Feed
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: 'var(--color-soil-600, #57534e)' }}
        >
          Follow the latest campaign, funding, milestone, and settlement events.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="mb-6 flex gap-2 items-end flex-wrap"
      >
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label
            htmlFor={inputId}
            className="text-xs font-medium"
            style={{ color: 'var(--color-soil-700, #44403c)' }}
          >
            Filter by campaign ID(s) — separate multiple IDs with commas
          </label>
          <input
            id={inputId}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="e.g. 1, 2, 3"
            className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2"
            style={{
              borderColor: 'var(--color-soil-200, #e7e5e4)',
              color: 'var(--color-soil-900, #1c1917)',
            }}
            aria-label="Campaign IDs to filter activity feed"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: 'var(--color-leaf-700, #15803d)' }}
        >
          {submitted ? 'Update filter' : 'Apply filter'}
        </button>
        {submitted && (
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm font-medium"
            style={{
              borderColor: 'var(--color-soil-200, #e7e5e4)',
              color: 'var(--color-soil-600, #57534e)',
            }}
            onClick={() => {
              setSubmitted('');
              setInputValue('');
            }}
          >
            Clear
          </button>
        )}
      </form>

      {campaignIds.length === 0 && !envIds.length ? (
        <div
          className="rounded-xl border p-8 text-center text-sm"
          style={{
            borderColor: 'var(--color-soil-200, #e7e5e4)',
            color: 'var(--color-soil-500, #78716c)',
          }}
        >
          Enter one or more campaign IDs above to view activity, or configure{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            VITE_KNOWN_CAMPAIGN_IDS
          </code>{' '}
          to preload the global feed.
        </div>
      ) : (
        <div
          className="rounded-xl border p-6"
          style={{
            borderColor: 'var(--color-soil-200, #e7e5e4)',
            background: 'white',
          }}
        >
          <ActivityFeed
            campaignId={scoped}
            campaignIds={scoped === undefined ? campaignIds : []}
            pageSize={10}
            refreshIntervalMs={30_000}
            title={
              scoped !== undefined
                ? `Campaign #${scoped} Activity`
                : 'All Activity'
            }
          />
        </div>
      )}
    </div>
  );
}
