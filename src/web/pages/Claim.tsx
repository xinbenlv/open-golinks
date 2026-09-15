/** 旧 /claim 入口与 edit 页共用认领控件及后端授权。 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ClaimOwnership } from "../components/ClaimOwnership";
import { useAuth } from "../hooks/useAuth";

export default function Claim() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { loading } = useAuth();
  const [link, setLink] = useState<{ ownerId: string | null } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setLink(null); setError("");
    void fetch(`/api/v1/links/${encodeURIComponent(slug)}`).then(async (res) => {
      if (!res.ok) throw new Error("Could not load this link.");
      const body = await res.json();
      if (!cancelled) setLink(body.link);
    }).catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [slug]);
  return <main className="auth-page"><section className="auth-panel auth-panel--compact">
    <h1>Claim /{slug}</h1>
    {error ? <p role="alert">{error}</p> : loading || !link ? <span className="spinner" aria-label="Loading" />
      : link.ownerId !== null ? <p role="status">This link already has an owner.</p>
      : <ClaimOwnership key={slug} slug={slug} onClaim={() => navigate(`/edit/${slug}`, { replace: true })} />}
    <Link to={`/edit/${slug}`} className="btn btn--ghost">Back to link</Link>
  </section></main>;
}
