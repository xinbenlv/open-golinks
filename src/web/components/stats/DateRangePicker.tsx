const RANGE_OPTIONS = [7, 30, 90, 180] as const;

export type StatsRange = (typeof RANGE_OPTIONS)[number];

export function DateRangePicker({
  value,
  onChange,
}: {
  value: StatsRange;
  onChange: (value: StatsRange) => void;
}) {
  return (
    <div className="segmented-control" aria-label="Date range">
      {RANGE_OPTIONS.map((range) => (
        <button
          key={range}
          className="segmented-control__button"
          type="button"
          aria-pressed={value === range}
          onClick={() => onChange(range)}
        >
          {range}d
        </button>
      ))}
    </div>
  );
}
