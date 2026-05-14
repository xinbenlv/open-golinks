import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  type DashboardLink,
  LinkRow,
} from "../components/LinkRow";
import { ClaimBanner } from "../components/ClaimBanner";
import { StatsChart } from "../components/StatsChart";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";

type LinksResponse = {
  links: DashboardLink[];
  nextCursor: string | null;
};

const PAGE_SIZE = 20;

export default function Dashboard() {
  const { user } = useAuth();
  const api = useApi();
  const [links, setLinks] = useState<DashboardLink[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryKey = query.trim();

  const listUrl = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams({
        owner: "me",
        limit: String(PAGE_SIZE),
      });
      if (queryKey) params.set("q", queryKey);
      if (cursor) params.set("cursor", cursor);
      return `/api/v1/links?${params.toString()}`;
    },
    [queryKey],
  );

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void api
        .request<LinksResponse>(listUrl())
        .then((body) => {
          if (cancelled) return;
          setLinks(body.links);
          setNextCursor(body.nextCursor);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "加载失败");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [api, listUrl]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const body = await api.request<LinksResponse>(listUrl(nextCursor));
      setLinks((current) => [...current, ...body.links]);
      setNextCursor(body.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoadingMore(false);
    }
  }

  async function deleteLink(slug: string) {
    if (!window.confirm(`Delete /${slug}?`)) return;
    setDeletingSlug(slug);
    setError(null);
    try {
      await api.request<null>(`/api/v1/links/${slug}`, { method: "DELETE" });
      setLinks((current) => current.filter((link) => link.slug !== slug));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeletingSlug(null);
    }
  }

  const emptyMessage = useMemo(() => {
    if (queryKey) return "No links match this search.";
    return "You have not created any links yet.";
  }, [queryKey]);

  return (
    <main className="dashboard-page">
      <section className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-kicker">Dashboard</p>
            <h1>My links</h1>
            <p>{user?.email ?? "Signed in"}</p>
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

        <div className="dashboard-toolbar">
          <input
            className="auth-input dashboard-search"
            type="search"
            placeholder="Search slug or URL"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <ClaimBanner />
        <StatsChart />

        {error ? (
          <div className="dashboard-alert" role="alert">
            {error}
          </div>
        ) : null}

        <div className="links-table" aria-busy={loading}>
          <div className="links-table__head">
            <span>Slug</span>
            <span>URL</span>
            <span>Visits</span>
            <span>Created</span>
            <span>Actions</span>
          </div>
          {loading ? (
            <div className="dashboard-empty">Loading links...</div>
          ) : links.length ? (
            links.map((link) => (
              <LinkRow
                key={link.slug}
                link={link}
                onDelete={deleteLink}
                deleting={deletingSlug === link.slug}
              />
            ))
          ) : (
            <div className="dashboard-empty">
              <p>{emptyMessage}</p>
              {!queryKey ? (
                <Link className="btn btn--primary btn--sm" to="/create">
                  Create your first link
                </Link>
              ) : null}
            </div>
          )}
        </div>

        {nextCursor && !loading ? (
          <div className="dashboard-load-more">
            <button
              className="btn btn--ghost"
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
