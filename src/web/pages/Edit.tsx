import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { AuditTimeline } from "../components/AuditTimeline";
import { TagInput } from "../components/TagInput";
import { UrlHistory } from "../components/UrlHistory";
import { WarnToggle } from "../components/WarnToggle";
import { authFetch, useAuth } from "../hooks/useAuth";
import { Landing } from "./Landing";

type LinkRecord = {
  slug: string;
  url: string;
  ownerId: string | null;
  deletedAt: string | null;
  urlHistory: unknown[];
  updatedAt: string;
  metadata: {
    description?: string;
    tags?: string[];
    show_warning?: boolean;
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
  const transferId = useId();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [showWarning, setShowWarning] = useState(false);
  const [transferEmail, setTransferEmail] = useState("");
  const [transferComplete, setTransferComplete] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
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
      setDescription(body.link.metadata?.description ?? "");
      setTags(Array.isArray(body.link.metadata?.tags) ? body.link.metadata.tags : []);
      setShowWarning(body.link.metadata?.show_warning === true);
    }

    if (slug) void load();
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

  if (!user) {
    return (
      <EditNotice
        title="登录后编辑"
        message={`/${slug} 已存在。登录 owner 账号后可以修改或删除这个短链。`}
        action={<Link to="/login" className="btn btn--primary">登录</Link>}
      />
    );
  }

  if (state.link.ownerId !== user.id) {
    return (
      <EditNotice
        title="没有编辑权限"
        message={`/${slug} 不属于当前登录账号。`}
      />
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await authFetch(`/api/v1/links/${slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url,
          metadata: {
            description,
            tags,
            show_warning: showWarning,
          },
        }),
      });
      if (!res.ok) {
        setError(`保存失败: HTTP ${res.status}`);
        return;
      }
      const body = (await res.json()) as { link: LinkRecord };
      setState({ status: "edit", link: body.link });
      setUrl(body.link.url);
      setDescription(body.link.metadata?.description ?? "");
      setTags(Array.isArray(body.link.metadata?.tags) ? body.link.metadata.tags : []);
      setShowWarning(body.link.metadata?.show_warning === true);
      setMessage("已保存。");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
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
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-copy">
          <h1>编辑 /{slug}</h1>
          <p>更新目标链接会保留旧 URL 历史。删除后该 slug 访问返回 404。</p>
        </div>
        <form className="auth-form" onSubmit={onSubmit}>
          <label className="auth-label" htmlFor={urlId}>目标链接</label>
          <input
            id={urlId}
            className="auth-input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <label className="auth-label" htmlFor={descriptionId}>Description</label>
          <textarea
            id={descriptionId}
            className="auth-input auth-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={280}
            placeholder="Short note for this link"
            rows={3}
          />
          <TagInput
            id={tagsId}
            value={tags}
            onChange={setTags}
            disabled={submitting}
          />
          <WarnToggle
            id={warnId}
            checked={showWarning}
            disabled={submitting}
            onChange={setShowWarning}
          />
          {message ? <p className="auth-message">{message}</p> : null}
          {error ? (
            <p className="auth-message auth-message--error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="create-success__row">
            <button className="btn btn--primary" type="submit" disabled={submitting}>
              {submitting ? "保存中..." : "保存"}
            </button>
            <button
              className="btn btn--ghost"
              type="button"
              onClick={onDelete}
              disabled={submitting}
            >
              删除
            </button>
          </div>
        </form>
        <UrlHistory
          currentUrl={state.link.url}
          updatedAt={state.link.updatedAt}
          history={state.link.urlHistory}
        />
        <form className="transfer-panel" onSubmit={onTransfer}>
          <div className="auth-copy">
            <p className="dashboard-kicker">Danger zone</p>
            <h2>Transfer ownership</h2>
            <p>Move this link to another registered user by email.</p>
          </div>
          <label className="auth-label" htmlFor={transferId}>
            Recipient email
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
        <AuditTimeline slug={slug} />
      </section>
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
