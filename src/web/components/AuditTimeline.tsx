import { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi";

type AuditLog = {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "CLAIM" | "TRANSFER";
  actorId: string | null;
  actorEmail: string | null;
  actorFingerprint: string | null;
  timestamp: string;
  diff: unknown;
};

type AuditResponse = {
  logs: AuditLog[];
  nextCursor: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function actorLabel(log: AuditLog) {
  if (log.actorEmail) return log.actorEmail;
  if (log.actorFingerprint) return `anonymous ${log.actorFingerprint.slice(0, 8)}`;
  if (log.actorId) return `deleted user ${log.actorId.slice(0, 8)}`;
  return "system";
}

function prettyJson(value: unknown) {
  if (!value || typeof value !== "object") return null;
  return JSON.stringify(value, null, 2);
}

export function AuditTimeline({ slug }: { slug: string }) {
  const api = useApi();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setExpanded({});
    void api
      .request<AuditResponse>(`/api/v1/audit/${slug}?limit=20`)
      .then((body) => {
        if (cancelled) return;
        setLogs(body.logs);
        setNextCursor(body.nextCursor);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "History unavailable");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, slug]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "20", cursor: nextCursor });
      const body = await api.request<AuditResponse>(`/api/v1/audit/${slug}?${params}`);
      setLogs((current) => [...current, ...body.logs]);
      setNextCursor(body.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "History unavailable");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="audit-timeline" aria-busy={loading}>
      <div className="audit-timeline__header">
        <div>
          <p className="dashboard-kicker">History</p>
          <h2>Audit log</h2>
        </div>
      </div>
      {error ? (
        <p className="auth-message auth-message--error" role="alert">
          History unavailable
        </p>
      ) : null}
      {loading ? (
        <div className="dashboard-empty">Loading history...</div>
      ) : logs.length ? (
        <div className="audit-timeline__list">
          {logs.map((log) => {
            const diff = prettyJson(log.diff);
            const canExpand = Boolean(diff);
            const isExpanded = expanded[log.id] === true;
            return (
              <article className="audit-event" key={log.id}>
                <div className="audit-event__main">
                  <time dateTime={log.timestamp}>{formatDate(log.timestamp)}</time>
                  <strong>{log.action}</strong>
                  <span>by {actorLabel(log)}</span>
                  {canExpand ? (
                    <button
                      className="btn btn--ghost btn--sm"
                      type="button"
                      onClick={() =>
                        setExpanded((current) => ({
                          ...current,
                          [log.id]: !isExpanded,
                        }))
                      }
                    >
                      {isExpanded ? "Hide diff" : "Show diff"}
                    </button>
                  ) : null}
                </div>
                {isExpanded && diff ? (
                  <pre className="audit-event__diff">{diff}</pre>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="dashboard-empty">No history yet</div>
      )}
      {nextCursor && !loading ? (
        <button
          className="btn btn--ghost"
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      ) : null}
    </section>
  );
}
