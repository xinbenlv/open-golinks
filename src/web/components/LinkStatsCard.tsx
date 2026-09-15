/** Edit 页统计卡片，复用现有 heatmap 和折线图。 */
import { useState, useEffect, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
const StatsHeatmap = lazy(() =>
  import("./stats/Heatmap").then((m) => ({ default: m.StatsHeatmap })),
);
const StatsLineChart = lazy(() =>
  import("./stats/LineChart").then((m) => ({ default: m.StatsLineChart })),
);
type StatsRow = {
  dimension: string;
  eventCount: number;
  activeUsers: number;
};

type StatsQueryResult = {
  rows: StatsRow[];
  totalEvents: number;
  source: "ga4";
};

export function LinkStatsCard({ slug }: { slug: string }) {
  const [result, setResult] = useState<StatsQueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetch("/api/v1/stats/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        range: 30,
        groupBy: "date",
        limit: 30,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as StatsQueryResult;
      })
      .then((body) => {
        if (!cancelled) setResult(body);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Stats unavailable");
          setResult(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const totals = (result?.rows ?? []).reduce(
    (acc, row) => ({
      events: acc.events + row.eventCount,
      users: acc.users + row.activeUsers,
    }),
    { events: 0, users: 0 },
  );
  const heatmapRows = (result?.rows ?? []).map((row) => ({
    date: row.dimension,
    eventCount: row.eventCount,
    activeUsers: row.activeUsers,
  }));

  return (
    <section className="edit-stats-card" aria-busy={loading}>
      <div className="edit-stats-card__header">
        <div>
          <h2>Last 30 days</h2>
        </div>
        <Link className="btn btn--ghost btn--sm" to={`/stats/${slug}`}>
          Full stats
        </Link>
      </div>
      <div className="edit-stats-card__metrics">
        <div className="stats-metric">
          <span>Events</span>
          <strong>
            {loading || error ? "--" : totals.events.toLocaleString()}
          </strong>
        </div>
        <div className="stats-metric">
          <span>Users</span>
          <strong>
            {loading || error ? "--" : totals.users.toLocaleString()}
          </strong>
        </div>
      </div>
      {error ? (
        <div className="dashboard-empty">Stats unavailable</div>
      ) : loading ? (
        <div className="dashboard-empty">Loading stats...</div>
      ) : result?.rows.length ? (
        <Suspense fallback={<p>Loading chart…</p>}>
          <div className="stats-card__stack">
            <StatsHeatmap rows={heatmapRows} totalDays={30} />
            <StatsLineChart rows={result.rows} />
          </div>
        </Suspense>
      ) : null}
    </section>
  );
}
