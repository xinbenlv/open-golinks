import { ActivityCalendar, type Activity, type Labels } from "react-activity-calendar";

export const HEATMAP_WEEKS = 52;
export const HEATMAP_DAYS = HEATMAP_WEEKS * 7;

export type StatsHeatmapRow = {
  date: string;
  eventCount: number;
  activeUsers?: number;
};

type StatsActivity = Activity & {
  activeUsers: number;
};

type StatsHeatmapProps = {
  rows: StatsHeatmapRow[];
  totalDays?: number;
  alignEndToWeekEnd?: boolean;
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

function todayDateKey() {
  return toDateKey(new Date());
}

function buildActivityData({
  rows,
  totalDays = HEATMAP_DAYS,
  alignEndToWeekEnd = false,
}: StatsHeatmapProps): StatsActivity[] {
  if (!rows.length) return [];

  const normalizedDays = Math.max(1, totalDays);
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const maxCount = Math.max(...rows.map((row) => row.eventCount));
  const end = parseStatsDate(todayDateKey());
  if (alignEndToWeekEnd) end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (normalizedDays - 1));

  return Array.from({ length: normalizedDays }, (_, index) => {
    const date = toDateKey(addUtcDays(start, index));
    const row = byDate.get(date);
    const count = row?.eventCount ?? 0;
    return {
      date,
      count,
      activeUsers: row?.activeUsers ?? 0,
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
  const statsActivity = activity as StatsActivity;
  const clicks = activity.count.toLocaleString();
  const users = statsActivity.activeUsers.toLocaleString();
  const clickSuffix = activity.count === 1 ? "click" : "clicks";
  const userSuffix = statsActivity.activeUsers === 1 ? "user" : "users";
  return `${clicks} ${clickSuffix}, ${users} ${userSuffix} on ${activity.date}`;
}

export function StatsHeatmap({
  rows,
  totalDays = HEATMAP_DAYS,
  alignEndToWeekEnd = false,
}: StatsHeatmapProps) {
  const data = buildActivityData({ rows, totalDays, alignEndToWeekEnd });

  if (!data.length) {
    return <div className="dashboard-empty">No data yet</div>;
  }

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
