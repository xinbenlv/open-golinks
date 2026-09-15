/** 确认提议的 diff 与身份记录；取消保留原表单并恢复焦点。 */
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { authFetch } from "../../hooks/useAuth";
import type { BrowserSubmissionMetadata, ProposalValues } from "../../../lib/proposals/types";
import { Diff } from "./Diff";

export function ProposalConfirmation({ endpoint, before, after, account, busy, error, cancel, submit }: {
  endpoint: string;
  before: ProposalValues;
  after: ProposalValues;
  account: { id: string; email?: string } | null;
  busy: boolean;
  error: string | null;
  cancel: () => void;
  submit: (event: FormEvent) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [identity, setIdentity] = useState<BrowserSubmissionMetadata>();
  const [identityError, setIdentityError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (account) return;
    const abort = new AbortController();
    setIdentity(undefined); setIdentityError("");
    void authFetch(endpoint + "/identity", { signal: abort.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load submission identity.");
        const body = await res.json();
        if (!body.identity || !("ip" in body.identity)) throw new Error("Your session changed. Close and reopen this confirmation.");
        if (!abort.signal.aborted) setIdentity(body.identity);
      }).catch((err) => { if (!abort.signal.aborted) setIdentityError(err.message); });
    return () => abort.abort();
  }, [endpoint, account?.id, retry]);
  useEffect(() => {
    const element = dialog.current!;
    const trigger = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => { element.close(); trigger?.focus(); };
  }, []);
  return (
    <dialog ref={dialog} className="metadata-dialog proposal-confirmation proposals-ui"
      aria-labelledby={id} aria-describedby={id + "-identity"}
      onCancel={(event) => { event.preventDefault(); if (!busy) cancel(); }}>
      <form onSubmit={(event) => { if (!account && !identity) { event.preventDefault(); return; } submit(event); }}>
        <h2 id={id}>Propose change</h2>
        <Diff before={before} after={after} />
        <div id={id + "-identity"} className="small confirmation-identity">
          {account ? <p>Associated with <span title={"Account ID: " + account.id}>{account.email ?? account.id}</span>.</p> : <>
            {identity ? <>
              <dl><div><dt>IP address</dt><dd>{identity.ip === "Unknown" ? "Unavailable" : identity.ip}</dd></div>
                <div><dt>Browser</dt><dd>{identity.browser} · {identity.os}</dd></div></dl>
              <details><summary>User-Agent</summary><code>{identity.ua || "Unavailable"}</code></details>
            </> : identityError ? <p role="alert">{identityError} <button type="button" className="text-button" onClick={() => setRetry((n) => n + 1)}>Retry</button></p> : <p role="status">Loading IP and browser…</p>}
            <p><Link to="/login">Log in</Link> to use your email / account ID instead.</p>
          </>}
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <div className="proposal-actions">
          <button autoFocus type="button" className="btn btn--ghost" onClick={cancel} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={busy || (!account && !identity)}>{busy ? "Submitting…" : "Submit proposal"}</button>
        </div>
      </form>
    </dialog>
  );
}
