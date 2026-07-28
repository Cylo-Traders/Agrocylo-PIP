import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}

export function ChartCard({
  title,
  description,
  className = '',
  children,
}: ChartCardProps) {
  const chartLabel = description ? `${title}. ${description}` : title;

  return (
    <div
      className={`rounded-campaign border border-soil-200 bg-white p-5 shadow-campaign sm:p-6 ${className}`}
    >
      <h3 className="text-h4 text-soil-900">{title}</h3>
      {description && (
        <p className="mt-1 text-body-sm text-soil-600">{description}</p>
      )}
      <div className="mt-4" role="img" aria-label={chartLabel}>
        {children}
      </div>
    </div>
  );
}

export function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-lg bg-soil-50 px-4 text-center text-body-sm text-soil-600">
      {message}
    </div>
  );
}
