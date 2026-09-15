import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Proposals } from "../components/proposals/Proposals";
import { LinkStatsCard } from "../components/LinkStatsCard";
import { AuditTimeline } from "../components/AuditTimeline";
import { QrCanvas } from "../components/QrCanvas";
import { TagInput } from "../components/TagInput";
import { UrlHistory } from "../components/UrlHistory";
import { authFetch, useAuth } from "../hooks/useAuth";
import { Landing } from "./Landing";

type LinkRecord = {
  slug: string;
  url: string;
  ownerId: string | null;
  isPublic: boolean;
  deletedAt: string | null;
  urlHistory: unknown[];
  updatedAt: string;
  revision: number;
  metadata: {
    description?: string;
    tags?: string[];
    show_warning?: boolean;
    addLogo?: boolean;
    caption?: string;
  } | null;
};

type LoadState =
  | { status: "loading" }
  | { status: "create" }
  | { status: "edit"; link: LinkRecord }
  | { status: "error"; message: string };

export default function Edit() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const urlId = useId();
  const descriptionId = useId();
  const tagsId = useId();
  const warnId = useId();
  const publicId = useId();
  const qrCaptionId = useId();
  const transferId = useId();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [url, setUrl] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [showWarning, setShowWarning] = useState(false);
  const [qrCaption, setQrCaption] = useState("");
  const [qrAddLogo, setQrAddLogo] = useState(true);
  const [transferEmail, setTransferEmail] = useState("");
  const [transferComplete, setTransferComplete] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    setMessage(null);
    setError(null);
    setTransferError(null);
    setTransferComplete(null);

    async function load() {
      const res = await fetch(`/api/v1/links/${slug}`);
      if (cancelled) return;
      if (res.status === 404) {
        setState({ status: "create" });
        return;
      }
      if (!res.ok) {
        setState({ status: "error", message: `加载失败: HTTP ${res.status}` });
        return;
      }
      const body = (await res.json()) as { link: LinkRecord };
      setState({ status: "edit", link: body.link });
      setUrl(body.link.url);
      setIsPublic(body.link.isPublic);
      setDescription(body.link.metadata?.description ?? "");
      setTags(Array.isArray(body.link.metadata?.tags) ? body.link.metadata.tags : []);
      setShowWarning(body.link.metadata?.show_warning === true);
      setQrCaption(body.link.metadata?.caption ?? "");
      setQrAddLogo(body.link.metadata?.addLogo !== false);
    }

    if (slug) void load().catch(() => { if (!cancelled) setState({ status: "error", message: "Could not load link. Please reload." }); });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.status === "create") {
    return <Landing initialSlug={slug} />;
  }

  if (state.status === "loading" || authLoading) {
    return (
      <main className="auth-page">
        <section className="auth-panel auth-panel--compact">
          <span className="spinner" aria-label="Loading" />
          <p className="auth-message">正在加载链接...</p>
        </section>
      </main>
    );
  }

  if (state.status === "error") {
    return <EditNotice title="无法编辑链接" message={state.message} />;
  }

  if (transferComplete) {
    return (
      <EditNotice
        title="Ownership transferred"
        message={`/${slug} now belongs to ${transferComplete}.`}
        action={<Link to="/dashboard" className="btn btn--primary">Dashboard</Link>}
      />
    );
  }

  const canEdit = Boolean(user && state.link.ownerId === user.id);
  const hasChanges = url !== state.link.url
    || description !== (state.link.metadata?.description ?? "")
    || isPublic !== state.link.isPublic
    || showWarning !== (state.link.metadata?.show_warning === true)
    || qrCaption !== (state.link.metadata?.caption ?? "")
    || qrAddLogo !== (state.link.metadata?.addLogo !== false)
    || JSON.stringify(tags) !== JSON.stringify(Array.isArray(state.link.metadata?.tags) ? state.link.metadata.tags : []);
  const shortUrl = typeof window === "undefined" ? `/${slug}` : `${window.location.origin}/${slug}`;
  const qrParams = new URLSearchParams({ addLogo: qrAddLogo ? "true" : "false" });
  if (qrCaption.trim()) qrParams.set("caption", qrCaption.trim());
  const qrPngPath = `/qr/${slug}.png?${qrParams.toString()}`;
  const qrDownloadPath = `/qr/d/${slug}.png?${qrParams.toString()}`;
  const publicTooltip =
    "只决定这个短链是否参与推荐、趋势榜等公开发现入口；不影响通过 slug 查看或跳转。";
  const warningTooltip = "访问者会先看到 warning page，再继续跳转到目标链接。";

  async function copyShortUrl() {
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await authFetch(`/api/v1/links/${slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url,
          baseRevision: state.status === "edit" ? state.link.revision : undefined,
          isPublic,
          metadata: {
            description,
            tags,
            show_warning: showWarning,
            addLogo: qrAddLogo,
            caption: qrCaption,
          },
        }),
      });
      if (!res.ok) {
        setError(res.status === 409 ? "The link changed. Refresh the page before saving." : `保存失败: HTTP ${res.status}`);
        return;
      }
      const body = (await res.json()) as { link: LinkRecord };
      setState({ status: "edit", link: body.link });
      setUrl(body.link.url);
      setIsPublic(body.link.isPublic);
      setDescription(body.link.metadata?.description ?? "");
      setTags(Array.isArray(body.link.metadata?.tags) ? body.link.metadata.tags : []);
      setShowWarning(body.link.metadata?.show_warning === true);
      setQrCaption(body.link.metadata?.caption ?? "");
      setQrAddLogo(body.link.metadata?.addLogo !== false);
      setMessage("已保存。");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (!canEdit) return;
    if (!window.confirm(`删除 /${slug}? 删除后访问该短链会返回 404。`)) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await authFetch(`/api/v1/links/${slug}`, {
        method: "DELETE",
      });
      if (res.status !== 204) {
        setError(`删除失败: HTTP ${res.status}`);
        return;
      }
      setState({ status: "create" });
    } finally {
      setSubmitting(false);
    }
  }

  async function onTransfer(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    const toEmail = transferEmail.trim();
    if (!toEmail) return;
    if (
      !window.confirm(
        `Transfer /${slug} to ${toEmail}? You will lose ownership immediately.`,
      )
    ) {
      return;
    }
    setTransferring(true);
    setTransferError(null);
    try {
      const res = await authFetch(`/api/v1/links/${slug}/transfer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toEmail }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        setTransferError(body?.error ?? `Transfer failed: HTTP ${res.status}`);
        return;
      }
      setTransferComplete(toEmail);
    } finally {
      setTransferring(false);
    }
  }

  return (
    <main className="auth-page edit-page">
      <div className="edit-page-stack">
        <section className="auth-panel edit-panel">
          <form className="auth-form" onSubmit={onSubmit}>
            <header className="edit-header">
              <div className="edit-identity">
                <p className="edit-domain">{new URL(shortUrl, "https://localhost").host}</p>
                <h1>/{state.link.slug}</h1>
              </div>
              <div className="edit-header__actions">
                <button className="btn btn--ghost" type="button" onClick={copyShortUrl}>
                  {copied ? "Copied" : "Copy"}
                </button>
                <a
                  className="btn btn--primary edit-go-button"
                  href={`/${encodeURIComponent(state.link.slug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Go to /${state.link.slug} (opens in a new tab)`}
                >
                  Go <span aria-hidden="true">↗</span>
                </a>
              </div>
            </header>
            {!canEdit && !user ? (
              <div className="edit-readonly">
                <Link to="/login">Log in to edit →</Link>
              </div>
            ) : null}

            <div className="edit-layout">
              <div className="edit-details">
                <div className="edit-fields">
                  <div className="edit-field-row">
                    <label className="auth-label" htmlFor={urlId}>Destination</label>
                    <input
                      id={urlId}
                      className="auth-input"
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      disabled={submitting || !canEdit}
                      required
                    />
                  </div>
                  <div className="edit-field-row">
                    <label className="auth-label" htmlFor={descriptionId}>Description</label>
                    <textarea
                      id={descriptionId}
                      className="auth-input auth-textarea"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={280}
                      placeholder="Add a description"
                      rows={2}
                      disabled={submitting || !canEdit}
                    />
                  </div>
                  <div className="edit-field-row">
                    <TagInput
                      id={tagsId}
                      value={tags}
                      onChange={setTags}
                      disabled={submitting || !canEdit}
                    />
                  </div>
                </div>
                <div className="edit-meta-row">
                  <label className="edit-switch" htmlFor={publicId} title={publicTooltip}>
                    <input
                      id={publicId}
                      type="checkbox"
                      checked={isPublic}
                      onChange={(event) => setIsPublic(event.target.checked)}
                      disabled={submitting || !canEdit}
                    />
                    <span aria-hidden="true" />
                    <strong>Public listing</strong>
                  </label>
                  <label className="edit-switch" htmlFor={warnId} title={warningTooltip}>
                    <input
                      id={warnId}
                      type="checkbox"
                      checked={showWarning}
                      onChange={(event) => setShowWarning(event.target.checked)}
                      disabled={submitting || !canEdit}
                    />
                    <span aria-hidden="true" />
                    <strong>Warn before opening</strong>
                  </label>
                </div>
              </div>
              <aside className="edit-qr-card" aria-labelledby="edit-qr-title">
                <h2 id="edit-qr-title" className="auth-label">QR code</h2>
                <div className="qr-preview-wrap">
                  <QrCanvas value={shortUrl} caption={qrCaption} addLogo={qrAddLogo} />
                </div>
                <div className="edit-qr-actions">
                  <a className="btn btn--ghost btn--sm" href={qrDownloadPath} download>
                    Download
                  </a>
                  <a className="edit-text-link" href={qrPngPath} target="_blank" rel="noreferrer">
                    Open PNG
                  </a>
                </div>
                <div className="edit-qr-options__body">
                  <label className="auth-label" htmlFor={qrCaptionId}>Caption</label>
                  <textarea
                    id={qrCaptionId}
                    className="auth-input auth-textarea"
                    value={qrCaption}
                    onChange={(event) => setQrCaption(event.target.value)}
                    maxLength={100}
                    placeholder="Add a caption"
                    rows={2}
                    disabled={submitting || !canEdit}
                  />
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={qrAddLogo}
                      onChange={(event) => setQrAddLogo(event.target.checked)}
                      disabled={submitting || !canEdit}
                    />
                    <span>Include logo</span>
                  </label>
                </div>
              </aside>
            </div>
            {canEdit && (hasChanges || submitting || message || error) ? (
              <footer className="edit-save-bar">
                <div role="status">
                  {!hasChanges && message ? <p className="auth-message">{message}</p> : null}
                  {error ? <p className="auth-message auth-message--error" role="alert">{error}</p> : null}
                </div>
                {hasChanges || submitting ? (
                  <button className="btn btn--primary" type="submit" disabled={submitting}>
                    {submitting ? "Saving..." : "Save"}
                  </button>
                ) : null}
              </footer>
            ) : null}
          </form>
          <Proposals key={`${slug}:${user?.id ?? 'anonymous'}`} slug={slug}
            active={{ url: state.link.url, description: state.link.metadata?.description ?? '' }}
            revision={state.link.revision} reviewBlocked={canEdit && hasChanges}
            changed={async () => {
              const res = await fetch(`/api/v1/links/${slug}`);
              if (!res.ok) throw new Error('Could not refresh the link. Please reload.');
              const body = await res.json() as { link: LinkRecord };
              setState({ status: 'edit', link: body.link });
              setUrl(body.link.url); setDescription(body.link.metadata?.description ?? '');
              setIsPublic(body.link.isPublic); setTags(body.link.metadata?.tags ?? []);
              setShowWarning(body.link.metadata?.show_warning === true);
              setQrCaption(body.link.metadata?.caption ?? ''); setQrAddLogo(body.link.metadata?.addLogo !== false);
            }} />
          {canEdit ? (
            <details className="edit-advanced">
              <summary>Manage link</summary>
              <UrlHistory
                currentUrl={state.link.url}
                updatedAt={state.link.updatedAt}
                history={state.link.urlHistory}
              />
              <form className="transfer-panel" onSubmit={onTransfer}>
                <div className="auth-copy">
                  <h2>Transfer ownership</h2>
                </div>
                <label className="auth-label" htmlFor={transferId}>
                  New owner’s registered email
                </label>
                <div className="transfer-panel__row">
                  <input
                    id={transferId}
                    className="auth-input"
                    type="email"
                    value={transferEmail}
                    onChange={(event) => setTransferEmail(event.target.value)}
                    placeholder="teammate@example.com"
                    disabled={transferring}
                    required
                  />
                  <button
                    className="btn btn--ghost"
                    type="submit"
                    disabled={transferring || !transferEmail.trim()}
                  >
                    {transferring ? "Transferring..." : "Transfer"}
                  </button>
                </div>
                {transferError ? (
                  <p className="auth-message auth-message--error" role="alert">
                    {transferError}
                  </p>
                ) : null}
              </form>
              <AuditTimeline key={state.link.revision} slug={slug} />
              <div className="edit-delete-row">
                <div><h2>Delete link</h2><p>This short link will stop working.</p></div>
                <button className="btn edit-delete-button" type="button" onClick={onDelete} disabled={submitting}>
                  Delete link
                </button>
              </div>
            </details>
          ) : null}
        </section>
        <LinkStatsCard slug={slug} />
      </div>
    </main>
  );
}

function EditNotice({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-panel auth-panel--compact">
        <h1>{title}</h1>
        <p className="auth-message">{message}</p>
        {action ?? (
          <Link to="/" className="btn btn--ghost">
            返回首页
          </Link>
        )}
      </section>
    </main>
  );
}
