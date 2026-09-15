/** Edit 页真实提议入口；访客仅看到自己的提议，审核身份由 API 返回。 */
import { useEffect, useState } from "react";
import type { ProposalValues } from "../../../lib/proposals/types";
import { authFetch, useAuth } from "../../hooks/useAuth";
import { useProposalList } from "./useProposalList";
import { MetadataDialog } from "./MetadataDialog";
import { ProposalCard } from "./ProposalCard";
import { ProposalComposer } from "./ProposalComposer";
export function Proposals({
  slug,
  active,
  revision,
  changed,
  reviewBlocked = false,
}: {
  slug: string;
  active: ProposalValues;
  revision: number;
  reviewBlocked?: boolean;
  changed: () => Promise<void>;
}) {
  const { user } = useAuth();
  const endpoint = `/api/v1/links/${encodeURIComponent(slug)}/proposals`;
  const [history, setHistory] = useState(false);
  const [composing, setComposing] = useState(false);
  const [details, setDetails] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const { data, error, setError, load } = useProposalList(
    endpoint,
    history,
    user?.id,
    revision,
    refresh,
  );
  useEffect(
    () => setDetails(undefined),
    [history, user?.id, revision, refresh],
  );
  async function decide(
    id: string,
    decision: "approve" | "reject",
    reason: string,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await authFetch(`${endpoint}/${id}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, reason }),
      });
      if (!res.ok) {
        if (res.status === 409) {
          await changed();
          setRefresh((n) => n + 1);
        }
        throw new Error(
          res.status === 409
            ? "This proposal or link has changed. The list has been refreshed."
            : `Review failed (HTTP ${res.status}).`,
        );
      }
      setMessage(
        decision === "approve"
          ? "Approved. The link is updated."
          : "Proposal rejected.",
      );
      await changed();
      setRefresh((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="proposals-section proposals-ui" data-testid="proposals">
      <div className="section-heading">
        <div>
          <h2>{history ? "Proposal history" : "Proposed changes"}</h2>
          <p className="small muted">
            {data?.canReview
              ? "Approve a change to apply it to this link."
              : "Suggest a destination or description. Track your proposals here."}
          </p>
        </div>
        {!composing ? (
          <button className="btn btn--ghost" onClick={() => setComposing(true)}>
            Propose a change
          </button>
        ) : null}
      </div>
      {composing ? (
        <ProposalComposer
          endpoint={endpoint}
          active={active}
          revision={revision}
          close={() => setComposing(false)}
          submitted={() => {
            setComposing(false);
            setHistory(false);
            setRefresh((n) => n + 1);
            setMessage(
              "Proposal submitted. The link stays unchanged until approved.",
            );
          }}
        />
      ) : null}
      <p role="status" className="small">
        {message}
      </p>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            className="text-button"
            onClick={() => setRefresh((n) => n + 1)}
          >
            Retry
          </button>
        </div>
      ) : null}
      {!data && !error ? <p role="status">Loading proposals…</p> : null}
      {data && !data.proposals.length ? (
        <div className="proposal-empty">
          <strong>
            {history
              ? "No reviewed proposals yet."
              : data.canReview
                ? "All caught up."
                : "No pending proposals."}
          </strong>
          <p>
            {data.canReview
              ? "New proposals will appear here."
              : "Anonymous proposals are tracked in this browser."}
          </p>
        </div>
      ) : null}
      {reviewBlocked && data?.canReview ? (
        <p className="small muted">
          Save your edits before reviewing proposals.
        </p>
      ) : null}
      <div className="proposal-list">
        {data?.proposals.map((p) => (
          <ProposalCard
            key={p.id}
            proposal={p}
            canReview={data.canReview}
            busy={busy || reviewBlocked}
            decide={decide}
            inspect={setDetails}
          />
        ))}
      </div>
      {data?.nextCursor ? (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void load(data.nextCursor!)
              .catch((err) => setError(err.message))
              .finally(() => setBusy(false));
          }}
        >
          Load more
        </button>
      ) : null}
      <button className="text-button" onClick={() => setHistory(!history)}>
        {history ? "Back to pending proposals" : "View proposal history"}
      </button>
      {details ? (
        <MetadataDialog
          endpoint={`${endpoint}/${details}/metadata`}
          close={() => setDetails(undefined)}
        />
      ) : null}
    </section>
  );
}
