import {
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { StatsChartRow } from "./LineChart";

const COLORS = [
  "var(--accent)",
  "var(--success)",
  "#60a5fa",
  "#fbbf24",
  "#f472b6",
  "#a78bfa",
  "#2dd4bf",
  "#fb7185",
];

export function StatsPieChart({ rows }: { rows: StatsChartRow[] }) {
  if (!rows.length) {
    return <div className="dashboard-empty">No data yet</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RechartsPieChart>
        <Pie
          data={rows}
          dataKey="eventCount"
          nameKey="dimension"
          innerRadius={62}
          outerRadius={98}
          paddingAngle={2}
        >
          {rows.map((row, index) => (
            <Cell key={row.dimension} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
        />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}
