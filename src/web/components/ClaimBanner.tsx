import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { computeFingerprint } from "../../lib/fingerprint";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";

type ClaimableLink = {
  slug: string;
  url: string;
  createdAt: string;
};

export function ClaimBanner() {
  const { user } = useAuth();
  const api = useApi();
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [links, setLinks] = useState<ClaimableLink[]>([]);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void computeFingerprint().then((fp) => {
      if (!cancelled) setFingerprint(fp);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!fingerprint) return;
    let cancelled = false;
    void api
      .request<{ links: ClaimableLink[] }>(
        `/api/v1/links/claimable?fingerprint=${fingerprint}`,
      )
      .then((body) => {
        if (!cancelled) setLinks(body.links);
      })
      .catch(() => {
        if (!cancelled) setLinks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [api, fingerprint]);

  async function claimAll() {
    if (!fingerprint || !links.length) return;
    setClaiming(true);
    try {
      await Promise.all(
        links.map((link) =>
          api.request(`/api/v1/links/${link.slug}/claim`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ fingerprint }),
          }),
        ),
      );
      window.location.reload();
    } finally {
      setClaiming(false);
    }
  }

  if (!links.length) return null;

  return (
    <section className="claim-banner">
      <div>
        <p className="dashboard-kicker">Unclaimed links</p>
        <h2>You have {links.length} link{links.length === 1 ? "" : "s"} to claim</h2>
        <p>{links.slice(0, 3).map((link) => `/${link.slug}`).join(", ")}</p>
      </div>
      <div className="claim-banner__actions">
        <button
          className="btn btn--primary btn--sm"
          type="button"
          onClick={claimAll}
          disabled={claiming}
        >
          {claiming ? "Claiming..." : "Claim all"}
        </button>
        <Link className="btn btn--ghost btn--sm" to={`/claim/${links[0]!.slug}`}>
          Review
        </Link>
      </div>
    </section>
  );
}
