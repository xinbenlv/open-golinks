export const FINGERPRINT_RE = /^[0-9a-f]{64}$/;

export function isFingerprint(value: unknown): value is string {
  return typeof value === "string" && FINGERPRINT_RE.test(value);
}

async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function screenSize() {
  if (typeof screen === "undefined") return "unknown";
  return `${screen.width}x${screen.height}x${screen.colorDepth}`;
}

function timezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  } catch {
    return "unknown";
  }
}

function fallbackToken() {
  const key = "golinks:fp-fallback-token";
  try {
    let token = localStorage.getItem(key);
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem(key, token);
    }
    return token;
  } catch {
    return crypto.randomUUID();
  }
}

async function canvasHash() {
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 80;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context unavailable");
  ctx.textBaseline = "top";
  ctx.font = "16px Inter, Arial, sans-serif";
  ctx.fillStyle = "#ff7a45";
  ctx.fillRect(4, 4, 80, 28);
  ctx.fillStyle = "#14141a";
  ctx.fillText("OpenGoLinks", 12, 10);
  ctx.strokeStyle = "#34d399";
  ctx.beginPath();
  ctx.arc(170, 34, 23, 0, Math.PI * 2);
  ctx.stroke();
  return sha256Hex(canvas.toDataURL());
}

export async function computeFingerprint() {
  const ua = typeof navigator === "undefined" ? "unknown" : navigator.userAgent;
  try {
    const canvas = await canvasHash();
    return sha256Hex([canvas, ua, timezone(), screenSize()].join("|"));
  } catch {
    return sha256Hex([ua, timezone(), screenSize(), fallbackToken()].join("|"));
  }
}

export function rememberCreatedLink(slug: string, fingerprint: string) {
  if (!isFingerprint(fingerprint)) return;
  try {
    const key = "golinks:created";
    const current = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
    const rows = Array.isArray(current) ? current : [];
    const next = [
      { slug, fingerprint, createdAt: new Date().toISOString() },
      ...rows.filter((row) => {
        return !(
          row &&
          typeof row === "object" &&
          "slug" in row &&
          row.slug === slug
        );
      }),
    ].slice(0, 50);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Claim is a convenience path; creation must not fail on storage errors.
  }
}
