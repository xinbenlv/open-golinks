/** 待审和历史共用单条提议；审核失败保留原因供重试。 */
import { useState } from "react";
import type { ProposalDTO } from "../../../lib/proposals/types";
import { Diff } from "./Diff";
export const formatTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
export function ProposalCard({
  proposal: p,
  canReview,
  busy,
  decide,
  inspect,
}: {
  proposal: ProposalDTO;
  canReview: boolean;
  busy: boolean;
  decide: (
    id: string,
    decision: "approve" | "reject",
    reason: string,
  ) => Promise<void>;
  inspect: (id: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <article
      className="proposal-card"
      data-testid="proposal-card"
      aria-label={`Proposal from ${p.proposer}`}
    >
      <div className="section-heading">
        <div className="proposer-line">
          {canReview && p.anonymousDetails ? <button type="button" className="proposal-identity" onClick={() => inspect(p.id)}
            title={[p.anonymousDetails.location?.label ?? "Location unknown", p.anonymousDetails.browser, p.anonymousDetails.os, p.anonymousDetails.device].join(" · ")}
            aria-label={"Anonymous IP " + p.anonymousDetails.ip + ": view submission details"}>{p.anonymousDetails.ip}</button> : <strong>{p.proposer}</strong>}
          <span className="status-pill">
            {p.stale ? "Needs a new proposal" : p.status}
          </span>
        </div>
        {canReview ? (
          <button className="text-button" onClick={() => inspect(p.id)}>
            Submission details ↗
          </button>
        ) : null}
      </div>
      <p className="small muted">Submitted {formatTime(p.submittedAt)}</p>
      {p.note ? <p className="proposal-note">{p.note}</p> : null}
      <Diff before={p.before} after={p.after} />
      {p.stale ? (
        <div className="conflict-note">
          The link changed after this was submitted. A new proposal is needed.
        </div>
      ) : null}
      {p.reviewedAt ? (
        <p className="small muted">
          {p.status === "approved" ? "Approved" : "Rejected"} by{" "}
          {p.reviewer ?? "Reviewer"} · {formatTime(p.reviewedAt)}
          {p.reason ? ` · ${p.reason}` : ""}
        </p>
      ) : null}
      {canReview && p.status === "pending" ? (
        rejecting ? (
          <form
            className="reject-form"
            onSubmit={(event) => {
              event.preventDefault();
              void decide(p.id, "reject", reason);
            }}
          >
            <label htmlFor={`reason-${p.id}`}>
              Reason{" "}
              <span className="muted">(optional, visible to proposer)</span>
            </label>
            <input
              autoFocus
              id={`reason-${p.id}`}
              className="auth-input"
              maxLength={280}
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
            />
            <div className="proposal-actions">
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy}
                onClick={() => setRejecting(false)}
              >
                Cancel
              </button>
              <button className="btn btn--primary" disabled={busy}>
                Confirm rejection
              </button>
            </div>
          </form>
        ) : (
          <div className="proposal-actions">
            <button
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => setRejecting(true)}
            >
              Reject
            </button>
            <button
              className="btn btn--primary"
              disabled={busy || p.stale}
              onClick={() => {
                void decide(p.id, "approve", "");
              }}
            >
              Approve &amp; apply
            </button>
          </div>
        )
      ) : null}
    </article>
  );
}
