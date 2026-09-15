/** 私有详情在打开时单独加载；原生 dialog 管理焦点和 Escape。 */
import { useEffect, useId, useRef, useState } from "react";
import type { SubmissionMetadata } from "../../../lib/proposals/types";
import { authFetch } from "../../hooks/useAuth";
export function MetadataDialog({
  endpoint,
  close,
}: {
  endpoint: string;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const title = useId();
  const [metadata, setMetadata] = useState<SubmissionMetadata | null>();
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const abort = new AbortController();
    void authFetch(endpoint, { signal: abort.signal })
      .then(async (res) => {
        if (!res.ok)
          throw new Error(
            res.status === 403
              ? "You no longer have access to these details."
              : "Submission details unavailable.",
          );
        const body = (await res.json()) as {
          metadata: SubmissionMetadata | null;
        };
        if (!abort.signal.aborted) setMetadata(body.metadata);
      })
      .catch((err) => {
        if (!abort.signal.aborted) setError(err.message);
      });
    return () => {
      abort.abort();
      dialog.close();
      trigger?.focus();
    };
  }, [endpoint]);
  return (
    <dialog
      ref={ref}
      className="metadata-dialog proposals-ui"
      aria-labelledby={title}
      onCancel={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Reviewer only</p>
          <h2 id={title}>Submission details</h2>
        </div>
        <button
          autoFocus
          className="btn btn--ghost"
          onClick={close}
          aria-label="Close submission details"
        >
          ✕
        </button>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : metadata === undefined ? (
        <p role="status">Loading details…</p>
      ) : metadata === null ? (
        <p>Submission details have expired.</p>
      ) : (
        <>
          <div className="approx-map">
            <svg
              viewBox="0 0 440 160"
              role="img"
              aria-label={
                metadata.location
                  ? `Approximate area: ${metadata.location.label}`
                  : "Map unavailable: location unknown"
              }
            >
              <rect width="440" height="160" fill="var(--bg-subtle)" />
              {metadata.location ? (
                <>
                  <path d="M0 80H440 M220 0V160" stroke="var(--border)" />
                  <circle
                    cx={220 + (metadata.location.longitude * 220) / 180}
                    cy={80 - (metadata.location.latitude * 80) / 90}
                    r="12"
                    fill="var(--brand-soft)"
                    stroke="var(--brand)"
                    strokeDasharray="3 3"
                  />
                </>
              ) : (
                <text
                  x="220"
                  y="85"
                  textAnchor="middle"
                  fill="var(--text-muted)"
                >
                  Location unknown
                </text>
              )}
            </svg>
            <strong>{metadata.location?.label ?? "Location unknown"}</strong>
            <p>
              {metadata.location
                ? `Approximate IP-derived area · accuracy about ${metadata.location.radiusKm} km or more. Coordinate overview, not a street map.`
                : "No reliable IP location available."}
            </p>
          </div>
          <dl className="metadata-grid">
            {Object.entries({
              Device: metadata.device,
              "Operating system": metadata.os,
              Browser: metadata.browser,
              Locale: metadata.locale,
              "IP address": metadata.ip,
            }).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd dir="auto">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="small muted">
            Device and language are reported by the browser and may be
            inaccurate. Details expire after 30 days.
          </p>
          <details className="raw-agent">
            <summary>Raw user agent</summary>
            <code>{metadata.ua || "Unknown"}</code>
          </details>
        </>
      )}
    </dialog>
  );
}
