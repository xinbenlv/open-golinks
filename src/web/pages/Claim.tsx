import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { computeFingerprint } from "../../lib/fingerprint";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";

type LinkRecord = {
  slug: string;
  url: string;
  createdAt: string;
  ownerId: string | null;
};

export default function Claim() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const api = useApi();
  const [link, setLink] = useState<LinkRecord | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch(`/api/v1/links/${slug}`).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ link: LinkRecord }>;
      }),
      computeFingerprint(),
    ])
      .then(([body, fp]) => {
        if (cancelled) return;
        setLink(body.link);
        setFingerprint(fp);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load link");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function claim() {
    if (!fingerprint) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.request(`/api/v1/links/${slug}/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fingerprint }),
      });
      setClaimed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || (!link && !error)) {
    return (
      <main className="auth-page">
        <section className="auth-panel auth-panel--compact">
          <span className="spinner" aria-label="Loading" />
          <p className="auth-message">Loading claim details...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <ClaimNotice
        title="Login to claim"
        message={`Sign in to claim /${slug}.`}
        action={<Link className="btn btn--primary" to="/login">Login</Link>}
      />
    );
  }

  if (claimed) {
    return (
      <ClaimNotice
        title="Claimed"
        message={`/${slug} is now in your dashboard.`}
        action={<Link className="btn btn--primary" to="/dashboard">Dashboard</Link>}
      />
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-copy">
          <h1>Claim /{slug}</h1>
          <p>{link?.url ?? "This link can be claimed if it matches this browser."}</p>
        </div>
        {error ? (
          <p className="auth-message auth-message--error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="create-success__row">
          <button
            className="btn btn--primary"
            type="button"
            onClick={claim}
            disabled={submitting || !fingerprint}
          >
            {submitting ? "Claiming..." : "Claim this link"}
          </button>
          <Link className="btn btn--ghost" to="/dashboard">
            Not mine
          </Link>
        </div>
      </section>
    </main>
  );
}

function ClaimNotice({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action: ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-panel auth-panel--compact">
        <h1>{title}</h1>
        <p className="auth-message">{message}</p>
        {action}
      </section>
    </main>
  );
}
