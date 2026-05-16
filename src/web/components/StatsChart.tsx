import { useEffect, useState } from "react";
import { HEATMAP_DAYS, StatsHeatmap } from "./stats/Heatmap";
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
          <StatsHeatmap rows={summary.days} alignEndToWeekEnd />
        ) : (
          <div className="dashboard-empty">No stats yet</div>
        )}
      </div>
    </section>
  );
}
