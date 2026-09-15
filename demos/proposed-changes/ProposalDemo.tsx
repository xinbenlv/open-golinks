import { useRef, useState, type FormEvent } from "react";
import { QrCanvas } from "../../src/web/components/QrCanvas";
import {
  actors,
  changed,
  decide,
  fixtureMetadata,
  formatTime,
  seed,
  type Metadata,
  type Proposal,
  type Role,
  type Values,
} from "./model";
import { Diff, MetadataDialog, ReviewCard } from "./Review";

export function ProposalDemo() {
  const [state, setState] = useState(seed);
  const [role, setRole] = useState<Role>("anonymous");
  const [draft, setDraft] = useState(state.active);
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const metadataTrigger = useRef<HTMLButtonElement | null>(null);
  function inspect(value: Metadata, trigger: HTMLButtonElement) {
    metadataTrigger.current = trigger;
    setMetadata(value);
  }
  function closeMetadata() {
    setMetadata(null);
    requestAnimationFrame(() => metadataTrigger.current?.focus());
  }
  const [ownIds, setOwnIds] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const reviewer = role === "owner" || role === "admin";
  const pending = state.proposals.filter((item) => item.status === "pending");
  const own = state.proposals.filter(
    (item) => ownIds.includes(item.id) && item.role === role,
  );
  const dirty = changed(state.active, draft).length > 0;
  const shortUrl = "https://zgzg.li/team-handbook";
  function field<K extends keyof Values>(key: K, value: Values[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  function switchRole(next: Role) {
    setRole(next);
    setDraft(state.active);
    setComposing(false);
    setNote("");
    setMessage("");
    setMetadata(null);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const url = new URL(draft.url);
      if (!["https:", "http:"].includes(url.protocol)) throw new Error();
    } catch {
      setMessage("Enter a valid http or https destination.");
      return;
    }
    if (!dirty) return;
    const time = new Date().toISOString();
    if (reviewer) {
      setState((previous) => ({
        ...previous,
        active: { ...draft },
        edits: [
          {
            before: previous.active,
            after: { ...draft },
            actor: actors[role],
            time,
          },
          ...previous.edits,
        ],
      }));
      setMessage("Link saved. Change history updated.");
    } else {
      const id = Math.max(...state.proposals.map((item) => item.id), 0) + 1;
      const proposal: Proposal = {
        id,
        proposer: actors[role],
        role,
        submitted: time,
        before: { ...state.active },
        after: {
          ...state.active,
          url: draft.url,
          description: draft.description,
        },
        note: note.trim(),
        metadata: { ...fixtureMetadata },
        status: "pending",
      };
      setState((previous) => ({
        ...previous,
        proposals: [proposal, ...previous.proposals],
      }));
      setOwnIds((previous) => [...previous, id]);
      setComposing(false);
      setDraft(state.active);
      setNote("");
      setMessage("Proposal submitted. The active link is unchanged.");
    }
  }
  function onDecision(
    id: number,
    status: "approved" | "rejected",
    reason: string,
  ) {
    if (dirty) {
      setMessage("Save or discard your edits before reviewing proposals.");
      return;
    }
    const next = decide(
      state,
      id,
      role,
      status,
      new Date().toISOString(),
      reason,
    );
    if (next === state) return;
    setState(next);
    setDraft(next.active);
    setMessage(
      status === "approved"
        ? "Proposal approved. Destination and change history updated."
        : "Proposal rejected. The active link is unchanged.",
    );
  }
  const history = state.proposals.filter((item) => item.status !== "pending");
  return (
    <>
      <aside className="demo-toolbar" aria-label="Demo controls">
        <div>
          <strong>Experience preview</strong>
          <span>Fictional data · resets on reload</span>
        </div>
        <div className="demo-controls">
          <label htmlFor="demo-role">View as</label>
          <select
            id="demo-role"
            value={role}
            onChange={(event) => switchRole(event.target.value as Role)}
          >
            <option value="anonymous">Anonymous visitor</option>
            <option value="member">Signed-in proposer</option>
            <option value="owner">Link owner</option>
            <option value="admin">Admin</option>
          </select>
          <button
            className="text-button"
            onClick={() => {
              const next = seed();
              setState(next);
              setDraft(next.active);
              setOwnIds([]);
              setComposing(false);
              setNote("");
              setMetadata(null);
              setMessage("Demo reset.");
            }}
          >
            Reset demo
          </button>
        </div>
      </aside>
      <main className="auth-page edit-page proposal-demo">
        <div className="edit-page-stack">
          <section className="auth-panel edit-panel">
            <form className="auth-form" onSubmit={submit}>
              <header className="edit-header">
                <div className="edit-identity">
                  <p className="edit-domain">zgzg.li</p>
                  <h1>/team-handbook</h1>
                </div>
                <div className="edit-header__actions">
                  <button
                    className="btn btn--ghost"
                    type="button"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(shortUrl)
                        .then(() => setCopied(true))
                        .catch(() => setMessage("Copy this link: " + shortUrl));
                    }}
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    className="btn btn--primary edit-go-button"
                    type="button"
                    onClick={() =>
                      setMessage(`Demo destination: ${state.active.url}`)
                    }
                  >
                    Go ↗
                  </button>
                </div>
              </header>
              <div className="edit-layout">
                <div className="edit-details">
                  <div className="edit-fields">
                    <div className="edit-field-row">
                      <label className="auth-label" htmlFor="active-url">
                        Destination
                      </label>
                      <input
                        className="auth-input"
                        id="active-url"
                        type="url"
                        required
                        value={reviewer ? draft.url : state.active.url}
                        readOnly={!reviewer}
                        onChange={(event) => field("url", event.target.value)}
                      />
                    </div>
                    <div className="edit-field-row">
                      <label
                        className="auth-label"
                        htmlFor="active-description"
                      >
                        Description
                      </label>
                      <textarea
                        className="auth-input auth-textarea"
                        id="active-description"
                        maxLength={280}
                        value={
                          reviewer
                            ? draft.description
                            : state.active.description
                        }
                        readOnly={!reviewer}
                        onChange={(event) =>
                          field("description", event.target.value)
                        }
                      />
                    </div>
                    <div className="edit-field-row">
                      <label className="auth-label" htmlFor="active-tags">
                        Tags
                      </label>
                      <input
                        className="auth-input"
                        id="active-tags"
                        value={reviewer ? draft.tags : state.active.tags}
                        readOnly={!reviewer}
                        onChange={(event) => field("tags", event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="edit-meta-row">
                    {(["public", "warning"] as const).map((key) => (
                      <label key={key} className="edit-switch">
                        <input
                          type="checkbox"
                          checked={(reviewer ? draft : state.active)[key]}
                          disabled={!reviewer}
                          onChange={(event) => field(key, event.target.checked)}
                        />
                        <span aria-hidden="true" />
                        <strong>
                          {key === "public"
                            ? "Public listing"
                            : "Warn before opening"}
                        </strong>
                      </label>
                    ))}
                  </div>
                </div>
                <aside className="edit-qr-card" aria-label="QR code">
                  <h2 className="auth-label">QR code</h2>
                  <div className="qr-preview-wrap">
                    <QrCanvas
                      value={shortUrl}
                      caption={draft.caption}
                      addLogo={draft.logo}
                    />
                  </div>
                  <div className="edit-qr-options__body">
                    <label className="auth-label" htmlFor="qr-caption">
                      Caption
                    </label>
                    <textarea
                      className="auth-input auth-textarea"
                      id="qr-caption"
                      value={draft.caption}
                      maxLength={100}
                      readOnly={!reviewer}
                      onChange={(event) => field("caption", event.target.value)}
                    />
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={draft.logo}
                        disabled={!reviewer}
                        onChange={(event) =>
                          field("logo", event.target.checked)
                        }
                      />
                      <span>Include logo</span>
                    </label>
                  </div>
                </aside>
              </div>
              {reviewer && dirty ? (
                <footer className="edit-save-bar">
                  <span className="small muted">Unsaved changes</span>
                  <div className="proposal-actions">
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setDraft(state.active)}
                    >
                      Discard
                    </button>
                    <button className="btn btn--primary">Save</button>
                  </div>
                </footer>
              ) : null}
            </form>
            <div className="demo-message" role="status">
              {message}
            </div>
            <section
              className="proposals-section"
              aria-labelledby="proposals-title"
            >
              <div className="section-heading">
                <div>
                  <h2 id="proposals-title">
                    {reviewer ? "Proposed changes" : "Suggest a change"}{" "}
                    {reviewer ? (
                      <span className="count">{pending.length}</span>
                    ) : null}
                  </h2>
                  {!reviewer ? (
                    <p className="muted small">
                      The owner or an admin can approve your suggestion.
                    </p>
                  ) : null}
                </div>
                {!reviewer && !composing ? (
                  <button
                    className="btn btn--primary"
                    onClick={() => {
                      setDraft(state.active);
                      setComposing(true);
                      setMessage("");
                    }}
                  >
                    Propose a change
                  </button>
                ) : null}
              </div>
              {composing && !reviewer ? (
                <form className="proposal-compose" onSubmit={submit}>
                  <label className="auth-label" htmlFor="proposed-url">
                    Proposed destination
                  </label>
                  <input
                    autoFocus
                    className="auth-input"
                    id="proposed-url"
                    type="url"
                    required
                    value={draft.url}
                    onChange={(event) => field("url", event.target.value)}
                  />
                  <label className="auth-label" htmlFor="proposed-description">
                    Proposed description
                  </label>
                  <textarea
                    id="proposed-description"
                    className="auth-input auth-textarea"
                    maxLength={280}
                    value={draft.description}
                    onChange={(event) =>
                      field("description", event.target.value)
                    }
                  />
                  <label className="auth-label" htmlFor="proposal-note">
                    Why this change? <span className="muted">(optional)</span>
                  </label>
                  <textarea
                    id="proposal-note"
                    className="auth-input auth-textarea"
                    maxLength={500}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="A little context helps the reviewer."
                  />
                  {dirty ? <Diff before={state.active} after={draft} /> : null}
                  <p className="small muted">
                    {role === "anonymous"
                      ? "Submitted anonymously. IP, approximate location, device/browser and locale accompany your proposal for owner/admin review."
                      : "Submitted as Maya Chen. Connection and device details accompany your proposal for owner/admin review."}
                  </p>
                  <div className="proposal-actions">
                    <button
                      className="btn btn--ghost"
                      type="button"
                      onClick={() => {
                        setComposing(false);
                        setDraft(state.active);
                      }}
                    >
                      Cancel
                    </button>
                    <button className="btn btn--primary" disabled={!dirty}>
                      Submit proposal
                    </button>
                  </div>
                </form>
              ) : null}
              {reviewer ? (
                pending.length ? (
                  <div className="proposal-list">
                    {pending.map((proposal) => (
                      <ReviewCard
                        key={proposal.id}
                        proposal={proposal}
                        active={state.active}
                        onDecision={onDecision}
                        inspect={inspect}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="proposal-empty">
                    <strong>All caught up</strong>
                    <p>No proposals waiting for review.</p>
                  </div>
                )
              ) : own.length ? (
                <div className="proposal-list">
                  {own.map((proposal) => (
                    <article className="proposal-card" key={proposal.id}>
                      <div className="section-heading">
                        <strong>Your proposal</strong>
                        <span className="status-pill">
                          {proposal.status === "approved"
                            ? "Approved · applied"
                            : proposal.status === "rejected"
                              ? "Rejected · not applied"
                              : "Pending review"}
                        </span>
                      </div>
                      <p className="small muted">
                        Submitted {formatTime(proposal.submitted)}
                      </p>
                      <Diff
                        before={proposal.before}
                        after={proposal.after}
                        afterLabel={
                          proposal.status === "approved" ? "After" : "Proposed"
                        }
                      />
                      {proposal.actor ? (
                        <p className="small">
                          {proposal.status === "approved"
                            ? "Approved"
                            : "Rejected"}{" "}
                          by {proposal.actor} · {formatTime(proposal.decided!)}
                          {proposal.reason ? (
                            <>
                              <br />
                              {proposal.reason}
                            </>
                          ) : null}
                        </p>
                      ) : (
                        <p className="small muted">
                          The active link stays unchanged until approval.
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              ) : !composing ? (
                <p className="small muted empty-copy">
                  You haven’t submitted a proposal in this demo session.
                </p>
              ) : null}
            </section>
            {reviewer ? (
              <details className="edit-advanced history-section">
                <summary>
                  Change history{" "}
                  <span className="small muted">
                    {history.length + state.edits.length} records
                  </span>
                </summary>
                {state.edits.map((edit, index) => (
                  <article className="history-item" key={`edit-${index}`}>
                    <strong>Link edited</strong>
                    <p className="small muted">
                      {edit.actor} · {formatTime(edit.time)}
                    </p>
                    <Diff
                      before={edit.before}
                      after={edit.after}
                      afterLabel="After"
                    />
                  </article>
                ))}
                {history.map((proposal) => (
                  <article className="history-item" key={proposal.id}>
                    <strong>
                      {proposal.status === "approved"
                        ? "Proposal approved · change applied"
                        : "Proposal rejected · no link change"}
                    </strong>
                    <p className="small">
                      Proposed by {proposal.proposer} ·{" "}
                      {formatTime(proposal.submitted)}
                      <br />
                      {proposal.status === "approved"
                        ? "Approved"
                        : "Rejected"}{" "}
                      by {proposal.actor} · {formatTime(proposal.decided!)}
                    </p>
                    {proposal.reason ? <p>{proposal.reason}</p> : null}
                    <Diff
                      before={proposal.before}
                      after={proposal.after}
                      afterLabel={
                        proposal.status === "approved" ? "After" : "Proposed"
                      }
                    />
                    <button
                      className="text-button"
                      onClick={(event) =>
                        inspect(proposal.metadata, event.currentTarget)
                      }
                    >
                      Submission details ↗
                    </button>
                  </article>
                ))}
              </details>
            ) : null}
          </section>
          <section className="edit-stats-card">
            <div className="section-heading">
              <h2>Last 30 days</h2>
              <span className="small muted">Demo stats</span>
            </div>
            <div className="edit-stats-card__metrics">
              <div className="stats-metric">
                <span>Events</span>
                <strong>1,284</strong>
              </div>
              <div className="stats-metric">
                <span>Users</span>
                <strong>846</strong>
              </div>
            </div>
            <svg
              className="demo-chart"
              viewBox="0 0 900 70"
              preserveAspectRatio="none"
              role="img"
              aria-label="Fictional visits trend over the last 30 days"
            >
              <path
                d="M0 60 L30 55 60 59 90 42 120 48 150 38 180 50 210 40 240 44 270 25 300 40 330 32 360 44 390 29 420 35 450 16 480 31 510 24 540 28 570 11 600 19 630 27 660 12 690 18 720 7 750 20 780 13 810 18 840 8 870 13 900 4"
                fill="none"
                stroke="var(--brand)"
                strokeWidth="2"
              />
            </svg>
          </section>
        </div>
      </main>
      {metadata && reviewer ? (
        <MetadataDialog metadata={metadata} close={closeMetadata} />
      ) : null}
    </>
  );
}
