import { useEffect, useState } from "react";
import { ActivityCalendar, type Activity, type Labels } from "react-activity-calendar";
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
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const HEATMAP_THEME = {
  light: [
    "var(--bg-subtle)",
    "color-mix(in oklab, var(--accent) 24%, var(--bg-subtle))",
    "color-mix(in oklab, var(--accent) 42%, var(--bg-subtle))",
    "color-mix(in oklab, var(--accent) 64%, var(--bg-subtle))",
    "var(--accent)",
  ],
  dark: [
    "var(--bg-subtle)",
    "color-mix(in oklab, var(--accent) 24%, var(--bg-subtle))",
    "color-mix(in oklab, var(--accent) 42%, var(--bg-subtle))",
    "color-mix(in oklab, var(--accent) 64%, var(--bg-subtle))",
    "var(--accent)",
  ],
};

function parseStatsDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addUtcDays(value: Date, days: number) {
  return new Date(value.getTime() + days * MS_PER_DAY);
}

function levelForCount(count: number, maxCount: number): Activity["level"] {
  if (count === 0 || maxCount === 0) return 0;
  return Math.max(1, Math.ceil((count / maxCount) * 4));
}

function buildActivityData(days: StatsDay[]): Activity[] {
  if (!days.length) return [];

  const lastDay = days[days.length - 1]!;
  const byDate = new Map(days.map((day) => [day.date, day.eventCount]));
  const maxCount = Math.max(...days.map((day) => day.eventCount));
  const end = parseStatsDate(lastDay.date);
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (HEATMAP_DAYS - 1));

  return Array.from({ length: HEATMAP_DAYS }, (_, index) => {
    const date = toDateKey(addUtcDays(start, index));
    const count = byDate.get(date) ?? 0;
    return {
      date,
      count,
      level: levelForCount(count, maxCount),
    };
  });
}

function heatmapLabels(data: Activity[]): Labels {
  const januaryYear =
    data.find((activity) => parseStatsDate(activity.date).getUTCMonth() === 0)?.date.slice(0, 4) ??
    "";

  return {
    months: [
      januaryYear,
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    weekdays: [...WEEKDAY_LABELS],
    legend: {
      less: "Less",
      more: "More",
    },
  };
}

function formatActivityLabel(activity: Activity) {
  const count = activity.count.toLocaleString();
  const suffix = activity.count === 1 ? "click" : "clicks";
  return `${count} ${suffix} on ${activity.date}`;
}

function StatsHeatmap({ days }: { days: StatsDay[] }) {
  const data = buildActivityData(days);

  return (
    <div className="stats-heatmap-shell">
      <ActivityCalendar
        blockMargin={3}
        blockRadius={2}
        blockSize={10}
        className="stats-heatmap"
        data={data}
        fontSize={10}
        labels={heatmapLabels(data)}
        showColorLegend
        showMonthLabels
        showTotalCount={false}
        showWeekdayLabels={["mon", "wed", "fri"]}
        theme={HEATMAP_THEME}
        tooltips={{
          activity: {
            text: formatActivityLabel,
            withArrow: true,
          },
        }}
      />
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
