interface ComingSoonCardProps {
  title: string;
  description: string;
}

/** Placeholder for chart sections that need data not yet available on-chain or via a backend endpoint. */
export function ComingSoonCard({ title, description }: ComingSoonCardProps) {
  return (
    <div className="rounded-campaign border border-dashed border-soil-300 bg-soil-50 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <h3 className="text-h4 text-soil-700">{title}</h3>
        <span className="status-badge bg-amber-100 text-amber-800">
          Coming soon
        </span>
      </div>
      <p className="mt-2 text-body-sm text-soil-600">{description}</p>
    </div>
  );
}
