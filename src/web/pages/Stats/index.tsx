import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  DateRangePicker,
  type StatsRange,
} from "../../components/stats/DateRangePicker";
import { StatsLineChart } from "../../components/stats/LineChart";
import { PathRegexInput } from "../../components/stats/PathRegexInput";
import { StatsPieChart } from "../../components/stats/PieChart";
import { useApi } from "../../hooks/useApi";

type StatsRow = {
  dimension: string;
  eventCount: number;
  activeUsers: number;
};

type StatsQueryResult = {
  rows: StatsRow[];
  totalEvents: number;
  source: "ga4";
  scope: { slugCount: number };
  dimension: "date" | "pagePath" | "pagePathPlusQueryString";
};

const LIMIT_OPTIONS = [10, 20, 50] as const;

function extractSlug(dimension: string) {
  const match = dimension.match(/^\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

export function StatsView({ slug }: { slug?: string }) {
  const api = useApi();
  const [range, setRange] = useState<StatsRange>(7);
  const [limit, setLimit] = useState<(typeof LIMIT_OPTIONS)[number]>(10);
  const [draftRegex, setDraftRegex] = useState("");
  const [pathRegex, setPathRegex] = useState("");
  const [usePathPlusQueryString, setUsePathPlusQueryString] = useState(false);
  const [pathResult, setPathResult] = useState<StatsQueryResult | null>(null);
  const [dateResult, setDateResult] = useState<StatsQueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const shared = {
      range,
      pathRegex: pathRegex || undefined,
      usePathPlusQueryString,
      slug,
    };
    setLoading(true);
    setError(null);

    async function load() {
      const [pathBody, dateBody] = await Promise.all([
        api.request<StatsQueryResult>("/api/v1/stats/query", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...shared, groupBy: "path", limit }),
        }),
        api.request<StatsQueryResult>("/api/v1/stats/query", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...shared, groupBy: "date", limit: range }),
        }),
      ]);
      if (cancelled) return;
      setPathResult(pathBody);
      setDateResult(dateBody);
    }

    void load()
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Stats unavailable");
          setPathResult(null);
          setDateResult(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [api, limit, pathRegex, range, slug, usePathPlusQueryString]);

  const totals = useMemo(() => {
    const rows = pathResult?.rows ?? [];
    return rows.reduce(
      (acc, row) => ({
        events: acc.events + row.eventCount,
        users: acc.users + row.activeUsers,
      }),
      { events: 0, users: 0 },
    );
  }, [pathResult]);

  const title = slug ? `Stats for /${slug}` : "Analytics";
  const scopeLabel = slug
    ? "Single link"
    : `${pathResult?.scope.slugCount ?? 0} owned links`;

  return (
    <main className="stats-page">
      <section className="stats-shell">
        <header className="dashboard-header stats-header">
          <div>
            <p className="dashboard-kicker">GA4 analytics</p>
            <h1>{title}</h1>
            <p>{scopeLabel}</p>
          </div>
          <div className="dashboard-header__actions">
            <Link className="btn btn--ghost" to="/dashboard">
              Dashboard
            </Link>
            <Link className="btn btn--primary" to="/create">
              New link
            </Link>
          </div>
        </header>

        <section className="stats-controls" aria-label="Stats controls">
          <div className="stats-control-group">
            <span className="auth-label">Range</span>
            <DateRangePicker value={range} onChange={setRange} />
          </div>
          <label className="stats-control-group">
            <span className="auth-label">Rows</span>
            <select
              className="stats-select"
              value={limit}
              onChange={(event) =>
                setLimit(Number(event.target.value) as (typeof LIMIT_OPTIONS)[number])
              }
            >
              {LIMIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  Top {option}
                </option>
              ))}
            </select>
          </label>
          <PathRegexInput
            value={draftRegex}
            onChange={setDraftRegex}
            onApply={() => setPathRegex(draftRegex.trim())}
          />
          <label className="checkbox stats-query-toggle">
            <input
              type="checkbox"
              checked={usePathPlusQueryString}
              onChange={(event) => setUsePathPlusQueryString(event.target.checked)}
            />
            <span>Include query string</span>
          </label>
        </section>

        {error ? (
          <div className="dashboard-alert" role="alert">
            Stats unavailable
          </div>
        ) : null}

        <section className="stats-summary-grid" aria-busy={loading}>
          <Metric label="Events" value={loading ? "--" : formatNumber(totals.events)} />
          <Metric label="Users" value={loading ? "--" : formatNumber(totals.users)} />
          <Metric label="Source" value={pathResult?.source.toUpperCase() ?? "GA4"} />
        </section>

        <div className="stats-grid">
          <section className="stats-card stats-card--wide">
            <div className="stats-card__header">
              <div>
                <p className="dashboard-kicker">Group by path</p>
                <h2>{pathResult?.dimension ?? "pagePath"}</h2>
              </div>
            </div>
            {loading ? (
              <div className="dashboard-empty">Loading stats...</div>
            ) : (
              <StatsTable rows={pathResult?.rows ?? []} currentSlug={slug} />
            )}
          </section>

          <section className="stats-card">
            <div className="stats-card__header">
              <div>
                <p className="dashboard-kicker">Percentage by path</p>
                <h2>Share</h2>
              </div>
            </div>
            {loading ? (
              <div className="dashboard-empty">Loading stats...</div>
            ) : (
              <StatsPieChart rows={pathResult?.rows ?? []} />
            )}
          </section>
        </div>

        <section className="stats-card stats-card--full">
          <div className="stats-card__header">
            <div>
              <p className="dashboard-kicker">Time visualization</p>
              <h2>By day</h2>
            </div>
          </div>
          {loading ? (
            <div className="dashboard-empty">Loading stats...</div>
          ) : (
            <StatsLineChart rows={dateResult?.rows ?? []} />
          )}
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="stats-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatsTable({
  rows,
  currentSlug,
}: {
  rows: StatsRow[];
  currentSlug?: string;
}) {
  if (!rows.length) {
    return <div className="dashboard-empty">No data yet</div>;
  }

  return (
    <div className="stats-table">
      <div className="stats-table__head">
        <span>Path</span>
        <span>Events</span>
        <span>Users</span>
      </div>
      {rows.map((row) => {
        const rowSlug = extractSlug(row.dimension);
        const canLink = rowSlug && rowSlug !== currentSlug;
        return (
          <div className="stats-table__row" key={row.dimension}>
            <div className="stats-table__path" title={row.dimension}>
              {canLink ? (
                <Link to={`/stats/${rowSlug}`}>{row.dimension}</Link>
              ) : (
                row.dimension
              )}
            </div>
            <div>{formatNumber(row.eventCount)}</div>
            <div>{formatNumber(row.activeUsers)}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function StatsIndex() {
  return <StatsView />;
}
