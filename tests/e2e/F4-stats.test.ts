import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Hono as HonoType } from "hono";

let app: HonoType;
let db: typeof import("../../src/db/db.ts").db;
let schema: typeof import("../../src/db/db.ts").schema;
let setStatsSummaryProviderForTests:
  typeof import("../../src/lib/ga4.ts").setStatsSummaryProviderForTests;

const touchedSlugs = new Set<string>();
const touchedUserIds = new Set<string>();

function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 48);
}

function decodeSub(token: string): string {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("JWT payload missing");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).sub;
}

async function generateAccessToken(label: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secret) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");
  }

  const email = `f4-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: secret,
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      type: "magiclink",
      email,
      redirect_to: "https://open-golinks-v2-hono-production.up.railway.app/auth/callback",
    }),
  });
  const data = (await res.json()) as { action_link?: string };
  if (!res.ok || !data.action_link) {
    throw new Error(`generate_link failed: ${res.status}`);
  }
  const follow = await fetch(data.action_link, { redirect: "manual" });
  const location = follow.headers.get("location");
  if (!location) throw new Error("magic link did not redirect");
  const params = new URLSearchParams(new URL(location).hash.replace(/^#/, ""));
  const token = params.get("access_token");
  if (!token) throw new Error("magic link did not return access_token");
  touchedUserIds.add(decodeSub(token));
  return token;
}

async function cleanupSlug(slug: string) {
  await db
    .delete(schema.auditLogsTable)
    .where(eq(schema.auditLogsTable.linkSlug, slug));
  await db
    .delete(schema.dailyVisitsTable)
    .where(eq(schema.dailyVisitsTable.linkSlug, slug));
  await db.delete(schema.linksTable).where(eq(schema.linksTable.slug, slug));
}

async function postLink(slug: string, url: string, token?: string) {
  touchedSlugs.add(slug);
  return app.request("/api/v1/links", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ slug, url }),
  });
}

beforeAll(async () => {
  const links = await import("../../src/routes/api/links.ts");
  const redirect = await import("../../src/routes/redirect.ts");
  const stats = await import("../../src/routes/api/stats.ts");
  const dbModule = await import("../../src/db/db.ts");
  const ga4 = await import("../../src/lib/ga4.ts");

  db = dbModule.db;
  schema = dbModule.schema;
  setStatsSummaryProviderForTests = ga4.setStatsSummaryProviderForTests;
  app = new Hono();
  app.route("/api/v1/links", links.linksRoute);
  app.route("/api/v1/stats", stats.statsRoute);
  app.route("/", redirect.redirectRoute);
});

afterAll(async () => {
  setStatsSummaryProviderForTests(null);
  for (const slug of touchedSlugs) {
    await cleanupSlug(slug);
  }
  for (const userId of touchedUserIds) {
    await db.delete(schema.usersTable).where(eq(schema.usersTable.id, userId));
  }
});

describe("F4 stats + GA4", () => {
  it("redirect sets _ga and reports a fire-and-forget page_view", async () => {
    const slug = uniqueSlug("f4-ga4");
    await cleanupSlug(slug);
    touchedSlugs.add(slug);
    await db.insert(schema.linksTable).values({
      slug,
      url: "https://example.com/f4-ga4",
      urlHistory: [],
    });

    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("https://www.google-analytics.com/mp/collect")) {
        calls.push({
          url,
          body: JSON.parse(String(init?.body ?? "{}")),
        });
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      const started = performance.now();
      const res = await app.request(`/${slug}`, {
        headers: { "user-agent": "f4-test", referer: "https://ref.example" },
      });
      const elapsed = performance.now() - started;
      expect(res.status).toBe(302);
      expect(res.headers.get("set-cookie")).toContain("_ga=");
      expect(elapsed).toBeLessThan(1000);

      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(calls).toHaveLength(1);
      const body = calls[0]!.body as {
        client_id?: string;
        events?: Array<{ name?: string; params?: Record<string, unknown> }>;
      };
      expect(body.client_id).toBeTruthy();
      expect(body.events?.[0]?.name).toBe("page_view");
      expect(body.events?.[0]?.params).toMatchObject({
        slug,
        source: "v2-hono",
        is_redirect: true,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("requires auth for stats summary", async () => {
    const res = await app.request("/api/v1/stats/summary");
    expect(res.status).toBe(401);
  });

  it("scopes stats summary to the current owner's slugs", async () => {
    const tokenA = await generateAccessToken("scope-a");
    const tokenB = await generateAccessToken("scope-b");
    const slugA = uniqueSlug("f4-owned");
    const slugB = uniqueSlug("f4-other");
    expect((await postLink(slugA, "https://example.com/a", tokenA)).status).toBe(201);
    expect((await postLink(slugB, "https://example.com/b", tokenB)).status).toBe(201);

    let capturedSlugs: string[] = [];
    setStatsSummaryProviderForTests(async (slugs, days) => {
      capturedSlugs = slugs;
      return {
        totalClicks: 7,
        days: Array.from({ length: days }, (_, i) => ({
          date: `2026-05-${String(i + 1).padStart(2, "0")}`,
          eventCount: i === 0 ? 7 : 0,
          activeUsers: i === 0 ? 3 : 0,
        })),
        source: "ga4",
        scope: { slugCount: slugs.length },
      };
    });

    const res = await app.request("/api/v1/stats/summary?days=7", {
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(capturedSlugs).toContain(slugA);
    expect(capturedSlugs).not.toContain(slugB);
    expect(body.totalClicks).toBe(7);
    expect(body.days).toHaveLength(7);
    expect(body.scope.slugCount).toBe(1);
  }, 30_000);

  it("returns 500 when the stats provider fails", async () => {
    const token = await generateAccessToken("failure");
    const slug = uniqueSlug("f4-fail");
    expect((await postLink(slug, "https://example.com/fail", token)).status).toBe(201);
    setStatsSummaryProviderForTests(async () => {
      throw new Error("GA4 down");
    });

    const originalError = console.error;
    console.error = () => undefined;
    try {
      const res = await app.request("/api/v1/stats/summary", {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "STATS_UNAVAILABLE" });
    } finally {
      console.error = originalError;
    }
  }, 30_000);
});
