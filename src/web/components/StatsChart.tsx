import { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi";

const HEATMAP_WEEKS = 52;
const HEATMAP_DAYS = HEATMAP_WEEKS * 7;

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
const QUARTER_MONTH_LABELS = new Set([0, 3, 6, 9]);

type HeatmapCell = {
  date: string;
  eventCount: number;
  level: 0 | 1 | 2 | 3 | 4;
  inRange: boolean;
};

type HeatmapWeek = {
  key: string;
  label: string;
  cells: HeatmapCell[];
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

function getWeekLabel(date: Date, previousDate: Date | null) {
  const month = date.getUTCMonth();
  const previousMonth = previousDate?.getUTCMonth();
  if (previousMonth === month) return "";
  if (month === 0) return String(date.getUTCFullYear());
  if (!QUARTER_MONTH_LABELS.has(month)) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function buildHeatmapWeeks(days: StatsDay[]): HeatmapWeek[] {
  if (!days.length) return [];

  const lastDay = days[days.length - 1]!;
  const byDate = new Map(days.map((day) => [day.date, day.eventCount]));
  const maxCount = Math.max(...days.map((day) => day.eventCount));
  const end = parseStatsDate(lastDay.date);
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (HEATMAP_DAYS - 1));

  return Array.from({ length: HEATMAP_WEEKS }, (_, weekIndex) => {
    const weekStart = new Date(start);
    weekStart.setUTCDate(start.getUTCDate() + weekIndex * 7);
    const previousWeekStart = weekIndex === 0
      ? null
      : new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    return {
      key: toDateKey(weekStart),
      label: getWeekLabel(weekStart, previousWeekStart),
      cells: Array.from({ length: 7 }, (_, dayIndex) => {
        const cursor = new Date(weekStart);
        cursor.setUTCDate(weekStart.getUTCDate() + dayIndex);
        const date = toDateKey(cursor);
        const eventCount = byDate.get(date) ?? 0;
        const level =
          eventCount === 0 || maxCount === 0
            ? 0
            : (Math.max(1, Math.ceil((eventCount / maxCount) * 4)) as 1 | 2 | 3 | 4);

        return {
          date,
          eventCount,
          level,
          inRange: byDate.has(date),
        };
      }),
    };
  });
}

function StatsHeatmap({ days }: { days: StatsDay[] }) {
  const [activeCell, setActiveCell] = useState<HeatmapCell | null>(null);
  const [pinnedDate, setPinnedDate] = useState<string | null>(null);
  const weeks = buildHeatmapWeeks(days);

  function showCell(cell: HeatmapCell, pinned = false) {
    setActiveCell(cell);
    if (pinned) setPinnedDate((current) => (current === cell.date ? null : cell.date));
  }

  return (
    <div
      className="stats-heatmap"
      role="group"
      aria-label="Daily clicks over the last 52 weeks"
    >
      <div className="stats-heatmap__days" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{VISIBLE_WEEKDAY_LABELS.has(label) ? label : ""}</span>
        ))}
      </div>
      <div className="stats-heatmap__body">
        <div className="stats-heatmap__months" aria-hidden="true">
          {weeks.map((week) => (
            <span key={week.key}>{week.label}</span>
          ))}
        </div>
        <div className="stats-heatmap__grid">
          {weeks.map((week) => (
            <div className="stats-heatmap__week" key={week.key}>
              {week.cells.map((cell) => (
                <button
                  key={cell.date}
                  type="button"
                  className={`stats-heatmap__cell stats-heatmap__cell--level-${cell.level}${
                    cell.inRange ? "" : " stats-heatmap__cell--empty"
                  }${pinnedDate === cell.date ? " stats-heatmap__cell--active" : ""}`}
                  title={formatCellLabel(cell)}
                  aria-label={formatCellLabel(cell)}
                  onClick={() => showCell(cell, true)}
                  onFocus={() => showCell(cell)}
                  onMouseEnter={() => showCell(cell)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {activeCell ? (
        <output className="stats-heatmap__tooltip">
          <strong>{activeCell.eventCount.toLocaleString()}</strong>
          <span>{activeCell.eventCount === 1 ? "click" : "clicks"}</span>
          <time dateTime={activeCell.date}>{activeCell.date}</time>
        </output>
      ) : null}
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
      .request<StatsSummary>(`/api/v1/stats/summary?days=${HEATMAP_DAYS}`)
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
          <p className="dashboard-kicker">Last 52 weeks</p>
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
