/** 提交前显示极简预览；失败时保留草稿，基线固定为打开表单时的版本。 */
import { useId, useState, type FormEvent } from "react";
import type { ProposalValues } from "../../../lib/proposals/types";
import { authFetch } from "../../hooks/useAuth";
import { Diff } from "./Diff";
export function ProposalComposer({
  endpoint,
  active,
  revision,
  close,
  submitted,
}: {
  endpoint: string;
  active: ProposalValues;
  revision: number;
  close: () => void;
  submitted: () => void;
}) {
  const id = useId();
  const [base] = useState({ ...active, revision });
  const [after, setAfter] = useState(active);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changed =
    after.url.trim() !== base.url ||
    after.description.trim() !== base.description;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await authFetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          baseRevision: base.revision,
          before: { url: base.url, description: base.description },
          after,
          note,
        }),
      });
      if (!res.ok)
        throw new Error(
          res.status === 409
            ? "The link changed. Close this draft, refresh the page and propose again."
            : res.status === 429
              ? "Too many proposals. Please try again later."
              : `Could not submit proposal (HTTP ${res.status}).`,
        );
      submitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="proposal-compose"
      onSubmit={submit}
      data-testid="proposal-composer"
    >
      <label className="auth-label" htmlFor={`${id}-url`}>
        Proposed destination
      </label>
      <input
        autoFocus
        className="auth-input"
        id={`${id}-url`}
        type="url"
        required
        maxLength={8192}
        value={after.url}
        disabled={busy}
        onChange={(e) => setAfter({ ...after, url: e.target.value })}
      />
      <label className="auth-label" htmlFor={`${id}-desc`}>
        Proposed description
      </label>
      <textarea
        className="auth-input"
        id={`${id}-desc`}
        rows={2}
        maxLength={280}
        value={after.description}
        disabled={busy}
        onChange={(e) => setAfter({ ...after, description: e.target.value })}
      />
      <label className="auth-label" htmlFor={`${id}-note`}>
        Why this change? <span className="muted">(optional)</span>
      </label>
      <textarea
        className="auth-input"
        id={`${id}-note`}
        rows={2}
        maxLength={500}
        value={note}
        disabled={busy}
        onChange={(e) => setNote(e.target.value)}
      />
      {changed ? (
        <Diff
          before={base}
          after={{
            url: after.url.trim(),
            description: after.description.trim(),
          }}
        />
      ) : null}
      <p className="small muted">
        An owner or admin must approve before the link changes. Your IP address,
        approximate location and browser details may be visible to reviewers for
        30 days.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      <div className="proposal-actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={close}
          disabled={busy}
        >
          Cancel
        </button>
        <button className="btn btn--primary" disabled={busy || !changed}>
          {busy ? "Submitting…" : "Submit proposal"}
        </button>
      </div>
    </form>
  );
}
