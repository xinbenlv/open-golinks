import { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi";

type StatsDay = {
  date: string;
  eventCount: number;
  activeUsers: number;
};

type StatsSummary = {
  totalClicks: number;
  days: StatsDay[];
  source: "ga4";
  scope: { slugCount: number };
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const VISIBLE_WEEKDAY_LABELS = new Set(["Mon", "Wed", "Fri"]);

type HeatmapCell = {
  date: string;
  eventCount: number;
  level: 0 | 1 | 2 | 3 | 4;
  inRange: boolean;
};

function parseStatsDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatCellLabel(cell: HeatmapCell) {
  if (!cell.inRange) return "No stats";
  const count = cell.eventCount.toLocaleString();
  const suffix = cell.eventCount === 1 ? "click" : "clicks";
  return `${count} ${suffix} on ${cell.date}`;
}

function buildHeatmapCells(days: StatsDay[]): HeatmapCell[] {
  if (!days.length) return [];

  const firstDay = days[0]!;
  const lastDay = days[days.length - 1]!;
  const byDate = new Map(days.map((day) => [day.date, day.eventCount]));
  const maxCount = Math.max(...days.map((day) => day.eventCount));
  const first = parseStatsDate(firstDay.date);
  const last = parseStatsDate(lastDay.date);
  const cursor = new Date(first);
  cursor.setUTCDate(first.getUTCDate() - first.getUTCDay());

  const cells: HeatmapCell[] = [];
  while (cursor <= last) {
    const date = toDateKey(cursor);
    const eventCount = byDate.get(date) ?? 0;
    const level =
      eventCount === 0 || maxCount === 0
        ? 0
        : (Math.max(1, Math.ceil((eventCount / maxCount) * 4)) as 1 | 2 | 3 | 4);

    cells.push({
      date,
      eventCount,
      level,
      inRange: byDate.has(date),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return cells;
}

function StatsHeatmap({ days }: { days: StatsDay[] }) {
  const cells = buildHeatmapCells(days);

  return (
    <div
      className="stats-heatmap"
      role="img"
      aria-label="Daily clicks over the last 30 days"
    >
      <div className="stats-heatmap__days" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{VISIBLE_WEEKDAY_LABELS.has(label) ? label : ""}</span>
        ))}
      </div>
      <div className="stats-heatmap__grid">
        {cells.map((cell) => (
          <span
            key={cell.date}
            className={`stats-heatmap__cell stats-heatmap__cell--level-${cell.level}${
              cell.inRange ? "" : " stats-heatmap__cell--empty"
            }`}
            title={formatCellLabel(cell)}
            aria-label={formatCellLabel(cell)}
          />
        ))}
      </div>
      <div className="stats-heatmap__legend" aria-hidden="true">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className={`stats-heatmap__cell stats-heatmap__cell--level-${level}`}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

export function StatsChart() {
  const api = useApi();
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api
      .request<StatsSummary>("/api/v1/stats/summary?days=30")
      .then((body) => {
        if (!cancelled) setSummary(body);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Stats unavailable");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <section className="stats-panel" aria-busy={loading}>
      <div className="stats-panel__summary">
        <div>
          <p className="dashboard-kicker">Last 30 days</p>
          <h2>{summary?.totalClicks.toLocaleString() ?? "--"}</h2>
          <p>Total clicks across {summary?.scope.slugCount ?? 0} links</p>
        </div>
        <span>{summary?.source ?? "ga4"}</span>
      </div>
      <div className="stats-panel__chart">
        {error ? (
          <div className="dashboard-empty">Stats unavailable</div>
        ) : loading ? (
          <div className="dashboard-empty">Loading stats...</div>
        ) : summary?.days.length ? (
          <StatsHeatmap days={summary.days} />
        ) : (
          <div className="dashboard-empty">No stats yet</div>
        )}
      </div>
    </section>
  );
}
