/** 无主链接的紧凑认领入口；复用 claim API，并把新 owner 交给页面状态。 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { canClaimOwnership } from "../../lib/identity";
import { authFetch, useAuth } from "../hooks/useAuth";

export function ClaimOwnership({ slug, onClaim }: {
  slug: string;
  onClaim: (ownerId: string) => void;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginUrl = `/login?claim=1&next=${encodeURIComponent(`/edit/${slug}`)}`;

  async function claim() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/api/v1/links/${encodeURIComponent(slug)}/claim`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(res.status === 409 ? "This link has already been claimed. Reload to see its owner." : res.status === 403 ? "Sign in with an @zgzg.io account to claim ownership." : res.status === 401 ? "Your session expired. Sign in again." : "Could not claim this link. Try again.");
      onClaim(body.link.ownerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not claim this link.");
    } finally { setBusy(false); }
  }

  async function switchAccount() {
    setBusy(true);
    setError(null);
    try { await signOut(); navigate(loginUrl); }
    catch { setError("Could not sign out. Try again."); }
    finally { setBusy(false); }
  }

  return <div className="edit-claim" data-testid="claim-ownership">
    {!user ? <Link className="text-button" to={loginUrl}>Login with your ZGID to claim and edit</Link>
      : !canClaimOwnership(user.email) ? <button className="text-button" type="button" disabled={busy} onClick={switchAccount}>Login with your ZGID to claim and edit</button>
      : <button className="text-button" type="button" disabled={busy} onClick={claim}>{busy ? "Claiming…" : "Claim ownership"}</button>}
    {error && <span role="alert">{error}</span>}
  </div>;
}
