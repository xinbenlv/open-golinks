import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QrCanvas } from "../components/QrCanvas";

type LinkRecord = {
  slug: string;
  url: string;
};

export default function QrEditor() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [link, setLink] = useState<LinkRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [includeCaption, setIncludeCaption] = useState(true);
  const [addLogo, setAddLogo] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void fetch(`/api/v1/links/${slug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as { link: LinkRecord };
      })
      .then((body) => {
        if (!cancelled) setLink(body.link);
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

  const shortUrl = useMemo(() => {
    if (typeof window === "undefined") return `/${slug}`;
    return `${window.location.origin}/${slug}`;
  }, [slug]);
  const pngParams = new URLSearchParams();
  if (includeCaption && caption.trim()) pngParams.set("caption", caption.trim());
  if (addLogo) pngParams.set("addLogo", "true");
  const pngQuery = pngParams.toString();
  const pngPath = `/qr/${slug}.png${pngQuery ? `?${pngQuery}` : ""}`;
  const downloadPath = `/qr/d/${slug}.png${pngQuery ? `?${pngQuery}` : ""}`;

  async function copyPngUrl() {
    await navigator.clipboard.writeText(`${window.location.origin}${pngPath}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  if (error) {
    return (
      <main className="auth-page">
        <section className="auth-panel auth-panel--compact">
          <h1>QR unavailable</h1>
          <p className="auth-message">{error}</p>
          <Link className="btn btn--ghost" to="/">
            Home
          </Link>
        </section>
      </main>
    );
  }

  if (!link) {
    return (
      <main className="auth-page">
        <section className="auth-panel auth-panel--compact">
          <span className="spinner" aria-label="Loading" />
          <p className="auth-message">Loading QR...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="qr-page">
      <section className="qr-shell">
        <div className="qr-panel">
          <div className="auth-copy">
            <p className="dashboard-kicker">QR code</p>
            <h1>QR for /{link.slug}</h1>
            <p>{link.url}</p>
          </div>
          <div className="qr-preview-wrap">
            <QrCanvas
              value={shortUrl}
              caption={includeCaption ? caption : ""}
              addLogo={addLogo}
            />
          </div>
        </div>

        <form className="qr-panel qr-controls" onSubmit={(event) => event.preventDefault()}>
          <label className="auth-label" htmlFor="qr-caption">
            Caption
          </label>
          <input
            id="qr-caption"
            className="auth-input"
            type="text"
            maxLength={100}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="测试中文"
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={includeCaption}
              onChange={(event) => setIncludeCaption(event.target.checked)}
            />
            <span>Include caption</span>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={addLogo}
              onChange={(event) => setAddLogo(event.target.checked)}
            />
            <span>Add logo</span>
          </label>
          <div className="create-success__row">
            <a className="btn btn--primary" href={downloadPath} download>
              Download PNG
            </a>
            <button className="btn btn--ghost" type="button" onClick={copyPngUrl}>
              {copied ? "Copied" : "Copy PNG URL"}
            </button>
          </div>
          <p className="auth-message">Scans to {shortUrl}</p>
        </form>
      </section>
    </main>
  );
}
