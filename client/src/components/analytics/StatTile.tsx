interface StatTileProps {
  label: string;
  value: string;
  sublabel?: string;
}

export function StatTile({ label, value, sublabel }: StatTileProps) {
  return (
    <div className="rounded-campaign border border-soil-200 bg-white p-4 shadow-campaign sm:p-5">
      <p className="text-label text-soil-600">{label}</p>
      <p className="mt-1 text-h3 text-soil-950">{value}</p>
      {sublabel && (
        <p className="mt-1 text-caption text-soil-600">{sublabel}</p>
      )}
    </div>
  );
}
