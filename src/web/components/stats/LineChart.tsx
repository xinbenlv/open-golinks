import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type StatsChartRow = {
  dimension: string;
  eventCount: number;
  activeUsers: number;
};

export function StatsLineChart({ rows }: { rows: StatsChartRow[] }) {
  if (!rows.length) {
    return <div className="dashboard-empty">No data yet</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RechartsLineChart data={rows}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="dimension"
          tick={{ fill: "var(--text-faint)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: "var(--text-faint)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
        />
        <Line
          type="monotone"
          dataKey="eventCount"
          name="Events"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="activeUsers"
          name="Users"
          stroke="var(--success)"
          strokeWidth={2}
          dot={false}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
