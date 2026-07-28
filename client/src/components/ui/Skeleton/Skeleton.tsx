import './Skeleton.css';

export interface SkeletonProps {
  className?: string;
  /** Accessible label announced by screen readers. */
  label?: string;
}

/** Single shimmer block. Compose into page-level skeleton layouts. */
export function Skeleton({ className = '', label }: SkeletonProps) {
  return (
    <div
      className={`ui-skeleton ${className}`}
      aria-hidden={label ? undefined : true}
      role={label ? 'status' : undefined}
      aria-label={label}
    />
  );
}

export function CampaignCardSkeleton() {
  return (
    <div
      className="ui-skeleton-card"
      role="status"
      aria-label="Loading campaign card"
    >
      <div className="ui-skeleton-card__header">
        <Skeleton className="ui-skeleton--badge" />
        <Skeleton className="ui-skeleton--chip" />
      </div>
      <Skeleton className="ui-skeleton--title" />
      <Skeleton className="ui-skeleton--line" />
      <Skeleton className="ui-skeleton--line ui-skeleton--line-short" />
      <Skeleton className="ui-skeleton--bar" />
      <div className="ui-skeleton-card__footer">
        <Skeleton className="ui-skeleton--button" />
      </div>
    </div>
  );
}

export function DashboardRowSkeleton() {
  return (
    <div
      className="ui-skeleton-row"
      role="status"
      aria-label="Loading dashboard row"
    >
      <Skeleton className="ui-skeleton--avatar" />
      <div className="ui-skeleton-row__content">
        <Skeleton className="ui-skeleton--line" />
        <Skeleton className="ui-skeleton--line ui-skeleton--line-short" />
      </div>
      <Skeleton className="ui-skeleton--chip" />
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div
      className="ui-skeleton-detail"
      role="status"
      aria-label="Loading detail page"
    >
      <Skeleton className="ui-skeleton--badge" />
      <Skeleton className="ui-skeleton--title ui-skeleton--title-lg" />
      <Skeleton className="ui-skeleton--line" />
      <Skeleton className="ui-skeleton--line" />
      <Skeleton className="ui-skeleton--line ui-skeleton--line-short" />
      <Skeleton className="ui-skeleton--panel" />
      <div className="ui-skeleton-detail__actions">
        <Skeleton className="ui-skeleton--button" />
        <Skeleton className="ui-skeleton--button ui-skeleton--button-wide" />
      </div>
    </div>
  );
}

export function DashboardRowsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="ui-skeleton-stack" role="status" aria-label="Loading rows">
      {Array.from({ length: count }, (_, i) => (
        <DashboardRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function CampaignCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className="ui-skeleton-grid"
      role="status"
      aria-label="Loading campaign cards"
    >
      {Array.from({ length: count }, (_, i) => (
        <CampaignCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="ui-skeleton-charts"
      role="status"
      aria-label="Loading analytics charts"
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="ui-skeleton--chart" />
      ))}
    </div>
  );
}
