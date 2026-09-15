/** slug 与相邻图标共用复制逻辑，保留独立导航和可访问反馈。 */
import { useEffect, useRef, useState, type RefObject } from "react";

export function ShortLinkActions({ slug, shortUrl, buttonRef }: { slug: string; shortUrl: string; buttonRef?: RefObject<HTMLButtonElement | null> }) {
  const [feedback, setFeedback] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(shortUrl);
      setFeedback("Copied");
      timer.current = setTimeout(() => setFeedback(""), 1400);
    } catch { setFeedback("Could not copy. Try again."); }
  }
  return <>
    <div className="edit-slug-row">
      <h1><button ref={buttonRef} className="edit-slug-copy" type="button" onClick={copy} title="Copy short link" aria-label={`/${slug} — copy short link`} data-testid="copy-slug">/{slug}</button></h1>
      <button className="edit-copy-icon" type="button" onClick={copy} title="Copy short link" aria-label="Copy short link" data-testid="copy-short-link">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          {feedback === "Copied" ? <path d="m5 12 4 4L19 6" /> : <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>}
        </svg>
      </button>
    </div>
    <span className="edit-copy-feedback" role="status" aria-live="polite">{feedback}</span>
  </>;
}
