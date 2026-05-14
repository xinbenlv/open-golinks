import { createHash } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import type { AuthEnv } from "./auth.ts";

type Bucket = {
  count: number;
  resetAt: number;
};

const minuteBuckets = new Map<string, Bucket>();
const hourBuckets = new Map<string, Bucket>();

function requestIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    c.req.header("cf-connecting-ip") ||
    forwarded ||
    c.req.header("x-real-ip") ||
    "unknown"
  );
}

function keyFor(c: Context): string {
  const ua = c.req.header("user-agent") ?? "";
  const uaHash = createHash("sha256").update(ua).digest("hex").slice(0, 16);
  return `${requestIp(c)}:${uaHash}`;
}

function consume(
  buckets: Map<string, Bucket>,
  key: string,
  limit: number,
  windowMs: number,
  now: number,
) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.ceil((current.resetAt - now) / 1000),
    };
  }
  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export const anonymousWriteRateLimit: MiddlewareHandler<AuthEnv> = async (
  c,
  next,
) => {
  if (c.get("user")) {
    await next();
    return;
  }

  const key = keyFor(c);
  const now = Date.now();
  const minute = consume(minuteBuckets, key, 5, 60_000, now);
  const hour = consume(hourBuckets, key, 30, 3_600_000, now);
  if (!minute.allowed || !hour.allowed) {
    const retryAfter = Math.max(minute.retryAfter, hour.retryAfter, 1);
    c.header("Retry-After", String(retryAfter));
    return c.json({ error: "RATE_LIMITED" }, 429);
  }

  await next();
};

export function resetRateLimitForTests() {
  minuteBuckets.clear();
  hourBuckets.clear();
}
