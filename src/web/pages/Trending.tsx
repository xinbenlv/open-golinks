import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, useApi } from "../hooks/useApi";

type TrendingRange = 7 | 30;

type TrendingLink = {
  slug: string;
  url: string;
  description: string | null;
  eventCount: number;
  activeUsers: number;
};

type TrendingResult = {
  links: TrendingLink[];
  range: TrendingRange;
  source: "ga4";
  scope: { slugCount: number };
};

const RANGE_OPTIONS: TrendingRange[] = [7, 30];

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

export default function Trending() {
  const api = useApi();
  const [range, setRange] = useState<TrendingRange>(7);
  const [result, setResult] = useState<TrendingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      const params = new URLSearchParams({
        range: String(range),
        limit: "20",
      });
      const body = await api.request<TrendingResult>(
        `/api/v1/stats/trending?${params.toString()}`,
      );
      if (cancelled) return;
      setResult(body);
    }

    void load()
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? "Trending unavailable"
              : "Network unavailable",
          );
          setResult(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [api, range]);

  return (
    <main className="stats-page">
      <section className="stats-shell">
        <header className="dashboard-header stats-header">
          <div>
            <p className="dashboard-kicker">Public discovery</p>
            <h1>Trending links</h1>
            <p>{result?.scope.slugCount ?? 0} public links in scope</p>
          </div>
          <div className="dashboard-header__actions">
            <Link className="btn btn--ghost" to="/stats">
              Stats
            </Link>
            <Link className="btn btn--primary" to="/create">
              New link
            </Link>
          </div>
        </header>

        <section className="stats-controls" aria-label="Trending controls">
          <div className="stats-control-group">
            <span className="auth-label">Range</span>
            <div className="trending-range" role="group" aria-label="Trending range">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={option === range ? "is-active" : ""}
                  onClick={() => setRange(option)}
                >
                  {option} days
                </button>
              ))}
            </div>
          </div>
        </section>

        {error ? (
          <div className="dashboard-alert" role="alert">
            {error}
          </div>
        ) : null}

        <section className="stats-card stats-card--full" aria-busy={loading}>
          <div className="stats-card__header">
            <div>
              <p className="dashboard-kicker">Ranked by clicks</p>
              <h2>Top public links</h2>
            </div>
          </div>
          {loading ? (
            <div className="dashboard-empty">Loading trending links...</div>
          ) : result?.links.length ? (
            <div className="trending-list">
              {result.links.map((link, index) => (
                <article className="trending-row" key={link.slug}>
                  <div className="trending-row__rank">{index + 1}</div>
                  <div className="trending-row__main">
                    <Link className="trending-row__slug" to={`/stats/${link.slug}`}>
                      /{link.slug}
                    </Link>
                    <p>{link.description || link.url}</p>
                  </div>
                  <div className="trending-row__metric">
                    <strong>{formatNumber(link.eventCount)}</strong>
                    <span>events</span>
                  </div>
                  <div className="trending-row__metric">
                    <strong>{formatNumber(link.activeUsers)}</strong>
                    <span>users</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty">No public trending links yet</div>
          )}
        </section>
      </section>
    </main>
  );
}
