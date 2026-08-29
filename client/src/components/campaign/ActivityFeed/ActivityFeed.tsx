import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCampaignActivities } from '../../../lib/contracts/registry';
import { contractQueryKeys } from '../../../hooks/contract/queryKeys';
import { isRegistryConfigured } from '../../../lib/soroban/config';
import type { ActivityRecord } from '../../../lib/soroban/types';
import { ActivityFeedItem } from './ActivityFeedItem';
import { Spinner } from '../../ui/Spinner/Spinner';
import './ActivityFeed.css';

interface ActivityFeedProps {
  /** When provided, shows only this campaign's activity. When omitted, shows
   *  the aggregated global feed from `campaignIds`. */
  campaignId?: bigint;
  /** List of campaign IDs to aggregate for the global feed (ignored when
   *  campaignId is provided). */
  campaignIds?: bigint[];
  /** Number of items per page. Defaults to 10. */
  pageSize?: number;
  /** Auto-refresh interval in ms. Defaults to 0 (disabled). */
  refreshIntervalMs?: number;
  title?: string;
}

function useCampaignActivity(
  campaignId: bigint | undefined,
  refreshIntervalMs: number,
) {
  return useQuery({
    queryKey: contractQueryKeys.activity(campaignId?.toString() ?? ''),
    enabled: campaignId !== undefined && isRegistryConfigured(),
    queryFn: () => getCampaignActivities(campaignId!),
    refetchInterval: refreshIntervalMs > 0 ? refreshIntervalMs : false,
    staleTime: 10_000,
  });
}

function useGlobalActivity(campaignIds: bigint[], refreshIntervalMs: number) {
  return useQuery({
    queryKey: ['globalActivity', campaignIds.map(String)],
    enabled: campaignIds.length > 0 && isRegistryConfigured(),
    queryFn: async (): Promise<ActivityRecord[]> => {
      const results = await Promise.allSettled(
        campaignIds.map((id) => getCampaignActivities(id)),
      );
      const all: ActivityRecord[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') all.push(...r.value);
      }
      return all.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
    },
    refetchInterval: refreshIntervalMs > 0 ? refreshIntervalMs : false,
    staleTime: 10_000,
  });
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  campaignId,
  campaignIds = [],
  pageSize = 10,
  refreshIntervalMs = 0,
  title,
}) => {
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();

  const isScoped = campaignId !== undefined;

  const scopedQuery = useCampaignActivity(
    isScoped ? campaignId : undefined,
    refreshIntervalMs,
  );
  const globalQuery = useGlobalActivity(
    isScoped ? [] : campaignIds,
    refreshIntervalMs,
  );

  const { data, isLoading, isError, error } = isScoped
    ? scopedQuery
    : globalQuery;

  const sorted = React.useMemo<ActivityRecord[]>(() => {
    if (!data) return [];
    if (isScoped) {
      return [...data].sort(
        (a, b) => Number(b.timestamp) - Number(a.timestamp),
      );
    }
    return data;
  }, [data, isScoped]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleRefresh = useCallback(() => {
    if (isScoped) {
      void queryClient.invalidateQueries({
        queryKey: contractQueryKeys.activity(campaignId!.toString()),
      });
    } else {
      void queryClient.invalidateQueries({ queryKey: ['globalActivity'] });
    }
    setPage(0);
  }, [isScoped, campaignId, queryClient]);

  const feedTitle =
    title ?? (isScoped ? 'Campaign Activity' : 'Platform Activity');

  return (
    <section className="activity-feed" aria-label={feedTitle}>
      <div className="activity-feed__header">
        <h2 className="activity-feed__title">{feedTitle}</h2>
        <button
          type="button"
          className="activity-feed__refresh"
          onClick={handleRefresh}
          disabled={isLoading}
          aria-label="Refresh activity feed"
        >
          ↻ Refresh
        </button>
      </div>

      {isLoading && (
        <div
          className="activity-feed__loading"
          role="status"
          aria-label="Loading activity"
        >
          <Spinner size="md" variant="primary" label={null} />
        </div>
      )}

      {isError && (
        <p className="activity-feed__error" role="alert">
          Failed to load activity.{' '}
          {error instanceof Error ? error.message : 'Please try refreshing.'}
        </p>
      )}

      {!isLoading && !isError && sorted.length === 0 && (
        <p className="activity-feed__empty">No activity recorded yet.</p>
      )}

      {!isLoading && paginated.length > 0 && (
        <ul className="activity-list" aria-label="Activity records">
          {paginated.map((record, i) => (
            <ActivityFeedItem
              key={`${record.actor}-${record.ledger_sequence}-${i}`}
              record={record}
              campaignId={isScoped ? campaignId : undefined}
            />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav
          className="activity-feed__pagination"
          aria-label="Activity feed pagination"
        >
          <button
            type="button"
            className="activity-feed__page-btn"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous page"
          >
            ← Prev
          </button>
          <span className="activity-feed__page-info" aria-live="polite">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            className="activity-feed__page-btn"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            aria-label="Next page"
          >
            Next →
          </button>
        </nav>
      )}
    </section>
  );
};
