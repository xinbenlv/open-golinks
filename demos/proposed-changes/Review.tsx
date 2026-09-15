import { InlineDiff } from "./InlineDiff";
import { useEffect, useRef, useState } from "react";
import {
  changed,
  formatTime,
  isStale,
  labels,
  type Metadata,
  type Proposal,
  type Values,
} from "./model";
export function Diff({
  before,
  after,
  afterLabel = "Proposed",
}: {
  before: Values;
  after: Values;
  afterLabel?: string;
}) {
  return (
    <dl className="proposal-diff">
      {changed(before, after).map((key) => {
        const oldValue =
          typeof before[key] === "boolean"
            ? before[key]
              ? "On"
              : "Off"
            : String(before[key]);
        const newValue =
          typeof after[key] === "boolean"
            ? after[key]
              ? "On"
              : "Off"
            : String(after[key]);
        return (
          <div className="diff-row" key={key}>
            <dt>{labels[key]}</dt>
            <dd
              aria-label={`Before: ${oldValue || "Empty"}. ${afterLabel}: ${newValue || "Empty"}.`}
            >
              <span aria-hidden="true">
                <InlineDiff before={oldValue} after={newValue} />
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function MetadataDialog({
  metadata,
  close,
}: {
  metadata: Metadata;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="metadata-dialog"
      onCancel={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      aria-labelledby="metadata-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Reviewer only · fictional data</p>
          <h2 id="metadata-title">Submission details</h2>
        </div>
        <button
          autoFocus
          className="btn btn--ghost"
          onClick={close}
          aria-label="Close submission details"
        >
          ✕
        </button>
      </div>
      <div className="approx-map">
        <svg
          viewBox="0 0 440 160"
          role="img"
          aria-label={
            metadata.location
              ? "Illustrative regional map showing an approximate area, not a precise location"
              : "Map unavailable: location unknown"
          }
        >
          <rect width="440" height="160" fill="var(--bg-subtle)" />
          <path
            d="M0 35 Q100 75 140 12 T250 20 L240 60 Q150 90 230 160 H0Z"
            fill="var(--bg-elevated)"
          />
          <g fill="none" stroke="var(--border-strong)" strokeWidth="2">
            <path d="M0 130 Q100 80 440 110 M30 0 Q180 80 390 160 M260 0 Q210 70 270 160 M0 40 L440 30" />
          </g>
          {metadata.location ? (
            <circle
              cx="210"
              cy="85"
              r="38"
              fill="var(--brand-soft)"
              stroke="var(--brand)"
              strokeDasharray="4 5"
            />
          ) : (
            <text x="220" y="85" textAnchor="middle" fill="var(--text-muted)">
              Location unknown
            </text>
          )}
        </svg>
        <strong>{metadata.location ?? "Location unknown"}</strong>
        <p>
          Approximate IP-derived area ·{" "}
          {metadata.location
            ? "not a precise location"
            : "no location available"}
        </p>
      </div>
      <dl className="metadata-grid">
        {Object.entries({
          Device: metadata.device,
          "Operating system": metadata.os,
          Browser: metadata.browser,
          Locale: metadata.locale,
          "IP address": metadata.ip,
        }).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <details className="raw-agent">
        <summary>Raw user agent</summary>
        <code>{metadata.ua}</code>
      </details>
    </dialog>
  );
}
export function ReviewCard({
  proposal,
  active,
  onDecision,
  inspect,
}: {
  proposal: Proposal;
  active: Values;
  onDecision: (
    id: number,
    status: "approved" | "rejected",
    reason: string,
  ) => void;
  inspect: (metadata: Metadata, trigger: HTMLButtonElement) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const stale = isStale(proposal, active);
  return (
    <article
      className="proposal-card"
      aria-label={`Proposal from ${proposal.proposer}`}
    >
      <div className="section-heading">
        <div className="proposer-line">
          <strong>{proposal.proposer}</strong>
          <span className="status-pill">
            {stale ? "Needs a new proposal" : "Pending"}
          </span>
        </div>
        <button
          className="text-button"
          onClick={(event) => inspect(proposal.metadata, event.currentTarget)}
        >
          Submission details ↗
        </button>
      </div>
      <p className="small muted">Submitted {formatTime(proposal.submitted)}</p>
      <p className="proposal-note">{proposal.note}</p>
      <Diff before={proposal.before} after={proposal.after} />
      {stale ? (
        <div className="conflict-note">
          <strong>The link changed after this was submitted.</strong>
          <p>
            Current destination: <span>{active.url}</span>
          </p>
          <p>
            Reject this proposal and ask for a new one based on the current
            link.
          </p>
        </div>
      ) : null}
      {rejecting ? (
        <form
          className="reject-form"
          onSubmit={(event) => {
            event.preventDefault();
            onDecision(proposal.id, "rejected", reason.trim());
          }}
        >
          <label htmlFor={`reason-${proposal.id}`}>
            Reason{" "}
            <span className="muted">(optional, visible to proposer)</span>
          </label>
          <input
            autoFocus
            id={`reason-${proposal.id}`}
            className="auth-input"
            value={reason}
            maxLength={280}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why isn’t this change needed?"
          />
          <div className="proposal-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setRejecting(false)}
            >
              Cancel
            </button>
            <button className="btn btn--primary">Confirm rejection</button>
          </div>
        </form>
      ) : (
        <div className="proposal-actions">
          <button className="btn btn--ghost" onClick={() => setRejecting(true)}>
            Reject
          </button>
          <button
            className="btn btn--primary"
            disabled={stale}
            onClick={() => onDecision(proposal.id, "approved", "")}
          >
            Approve & apply
          </button>
        </div>
      )}
    </article>
  );
}
