/** 审计按事件显示操作者与提议者；匿名 IP 可悬停或点击查看私有详情。 */
import { MetadataDialog } from "./proposals/MetadataDialog";
import type { BrowserSubmissionMetadata } from "../../lib/proposals/types";
import { Diff } from "./proposals/Diff";
import type { ProposalValues } from "../../lib/proposals/types";
import { useEffect, useState } from "react";
import { useApi } from "../hooks/useApi";

type AuditLog = {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "CLAIM" | "TRANSFER" | "PROPOSE" | "APPROVE_PROPOSAL" | "REJECT_PROPOSAL";
  actorId: string | null;
  actorEmail: string | null;
  actorFingerprint: string | null;
  timestamp: string;
  diff: unknown;
  proposer?: string | null;
  submittedAt?: string | null;
  metadata?: { proposalId?: string };
  anonymousDetails?: BrowserSubmissionMetadata;
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
  return log.action === "PROPOSE" ? "anonymous visitor" : "system";
}

function prettyJson(value: unknown) {
  if (!value || typeof value !== "object") return null;
  return JSON.stringify(value, null, 2);
}

export function AuditTimeline({ slug }: { slug: string }) {
  const api = useApi();
  const [details, setDetails] = useState<string>();
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

  const changes = logs.filter((log) => log.action !== "PROPOSE");
  return (
    <section className="audit-timeline proposals-ui" aria-busy={loading}>
      {error ? (
        <p className="auth-message auth-message--error" role="alert">
          History unavailable
        </p>
      ) : null}
      {loading ? (
        <div className="dashboard-empty">Loading history...</div>
      ) : changes.length ? (
        <div className="audit-timeline__list">
          {changes.map((log) => {
            const diff = prettyJson(log.diff);
            const canExpand = Boolean(diff);
            const isExpanded = expanded[log.id] === true;
            return (
              <article className="audit-event" key={log.id}>
                <div className="audit-event__main">
                  <time dateTime={log.timestamp}>{formatDate(log.timestamp)}</time>
                  <strong>{({ PROPOSE: "Proposed change", APPROVE_PROPOSAL: "Approved proposal", REJECT_PROPOSAL: "Rejected proposal" } as Record<string,string>)[log.action] ?? log.action}</strong>
                  <span>by {actorLabel(log)}</span>
                  {log.proposer && log.action !== "PROPOSE" ? <span>Proposed by {log.proposer}{log.submittedAt ? " · " + formatDate(log.submittedAt) : ""}</span> : null}
                  {log.anonymousDetails && log.metadata?.proposalId ? <button type="button" className="proposal-identity"
                    title={[log.anonymousDetails.location?.label ?? "Location unknown", log.anonymousDetails.browser, log.anonymousDetails.os, log.anonymousDetails.device].join(" · ")}
                    onClick={() => setDetails(log.metadata!.proposalId)}>{log.anonymousDetails.ip}</button> : null}
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
                  ['PROPOSE', 'APPROVE_PROPOSAL', 'REJECT_PROPOSAL'].includes(log.action)
                    ? <Diff before={(log.diff as { before: ProposalValues }).before} after={(log.diff as { after: ProposalValues }).after} />
                    : <pre className="audit-event__diff">{diff}</pre>
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
      {details ? <MetadataDialog endpoint={`/api/v1/links/${encodeURIComponent(slug)}/proposals/${details}/metadata`} close={() => setDetails(undefined)} /> : null}
    </section>
  );
}
