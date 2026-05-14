import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Hono as HonoType } from "hono";
import type {
  StatsQueryInput,
  StatsQueryResult,
} from "../../src/lib/ga4.ts";

let app: HonoType;
let db: typeof import("../../src/db/db.ts").db;
let schema: typeof import("../../src/db/db.ts").schema;
let setStatsQueryProviderForTests:
  typeof import("../../src/lib/ga4.ts").setStatsQueryProviderForTests;

const touchedSlugs = new Set<string>();
const touchedUserIds = new Set<string>();

function uniqueSlug(prefix: string) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${suffix}`.slice(0, 48);
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

  const email = `f8-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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

async function postLink(slug: string, url: string, token: string) {
  touchedSlugs.add(slug);
  return app.request("/api/v1/links", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ slug, url }),
  });
}

async function postStatsQuery(token: string, body: Record<string, unknown>) {
  return app.request("/api/v1/stats/query", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

function result(input: StatsQueryInput, rows = [
  { dimension: "/f8-owned", eventCount: 11, activeUsers: 5 },
]): StatsQueryResult {
  return {
    rows,
    totalEvents: rows.reduce((sum, row) => sum + row.eventCount, 0),
    source: "ga4",
    scope: { slugCount: input.slugs.length },
    dimension: input.groupBy === "date"
      ? "date"
      : input.usePathPlusQueryString
        ? "pagePathPlusQueryString"
        : "pagePath",
  };
}

beforeAll(async () => {
  const links = await import("../../src/routes/api/links.ts");
  const redirect = await import("../../src/routes/redirect.ts");
  const stats = await import("../../src/routes/api/stats.ts");
  const dbModule = await import("../../src/db/db.ts");
  const ga4 = await import("../../src/lib/ga4.ts");

  db = dbModule.db;
  schema = dbModule.schema;
  setStatsQueryProviderForTests = ga4.setStatsQueryProviderForTests;

  app = new Hono();
  app.route("/api/v1/links", links.linksRoute);
  app.route("/api/v1/stats", stats.statsRoute);
  app.route("/", redirect.redirectRoute);
});

beforeEach(() => {
  setStatsQueryProviderForTests(null);
});

afterAll(async () => {
  setStatsQueryProviderForTests(null);
  for (const slug of touchedSlugs) {
    await cleanupSlug(slug);
  }
  for (const userId of touchedUserIds) {
    await db.delete(schema.usersTable).where(eq(schema.usersTable.id, userId));
  }
});

describe("F8 detailed stats", () => {
  it("requires auth for controlled stats queries", async () => {
    const res = await app.request("/api/v1/stats/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ groupBy: "path" }),
    });
    expect(res.status).toBe(401);
  });

  it("scopes path queries to the current owner's slugs and allowlisted params", async () => {
    const tokenA = await generateAccessToken("scope-a");
    const tokenB = await generateAccessToken("scope-b");
    const slugA = uniqueSlug("f8-owned");
    const slugB = uniqueSlug("f8-other");
    expect((await postLink(slugA, "https://example.com/a", tokenA)).status).toBe(201);
    expect((await postLink(slugB, "https://example.com/b", tokenB)).status).toBe(201);

    let captured: StatsQueryInput | null = null;
    setStatsQueryProviderForTests(async (input) => {
      captured = input;
      return result(input, [
        { dimension: `/${slugA}?utm=one`, eventCount: 9, activeUsers: 4 },
      ]);
    });

    const res = await postStatsQuery(tokenA, {
      range: 30,
      groupBy: "path",
      limit: 5,
      pathRegex: `^/${slugA}`,
      usePathPlusQueryString: true,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(captured?.slugs).toContain(slugA);
    expect(captured?.slugs).not.toContain(slugB);
    expect(captured).toMatchObject({
      range: 30,
      groupBy: "path",
      limit: 5,
      pathRegex: `^/${slugA}`,
      usePathPlusQueryString: true,
    });
    expect(body.dimension).toBe("pagePathPlusQueryString");
    expect(body.rows[0]).toMatchObject({ eventCount: 9, activeUsers: 4 });
  }, 30_000);

  it("supports date queries and rejects slug detail access for non-owners", async () => {
    const tokenA = await generateAccessToken("date-owner");
    const tokenB = await generateAccessToken("date-other");
    const slugA = uniqueSlug("f8-date");
    expect((await postLink(slugA, "https://example.com/date", tokenA)).status).toBe(201);

    let captured: StatsQueryInput | null = null;
    setStatsQueryProviderForTests(async (input) => {
      captured = input;
      return result(input, [
        { dimension: "2026-05-13", eventCount: 3, activeUsers: 2 },
      ]);
    });

    const owned = await postStatsQuery(tokenA, {
      slug: slugA,
      range: 7,
      groupBy: "date",
      limit: 7,
    });
    expect(owned.status).toBe(200);
    const body = await owned.json();
    expect(captured?.slugs).toEqual([slugA]);
    expect(body.dimension).toBe("date");
    expect(body.rows[0].dimension).toBe("2026-05-13");

    const foreign = await postStatsQuery(tokenB, {
      slug: slugA,
      range: 7,
      groupBy: "path",
      limit: 10,
    });
    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toEqual({ error: "NOT_FOUND" });
  }, 30_000);

  it("returns empty data without touching GA4 when the user has no links", async () => {
    const token = await generateAccessToken("empty");

    const res = await postStatsQuery(token, {
      range: 7,
      groupBy: "path",
      limit: 10,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toEqual([]);
    expect(body.scope.slugCount).toBe(0);
  }, 30_000);

  it("rejects unsupported query shapes", async () => {
    const token = await generateAccessToken("invalid");
    expect((await postStatsQuery(token, { range: 14 })).status).toBe(400);
    expect((await postStatsQuery(token, { limit: 181 })).status).toBe(400);
    expect(
      (await postStatsQuery(token, { pathRegex: "x".repeat(181) })).status,
    ).toBe(400);
  }, 30_000);

  it("returns 500 when the stats query provider fails", async () => {
    const token = await generateAccessToken("failure");
    const slug = uniqueSlug("f8-fail");
    expect((await postLink(slug, "https://example.com/fail", token)).status).toBe(201);
    setStatsQueryProviderForTests(async () => {
      throw new Error("GA4 down");
    });

    const originalError = console.error;
    console.error = () => undefined;
    try {
      const res = await postStatsQuery(token, {
        range: 7,
        groupBy: "path",
        limit: 10,
      });
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "STATS_UNAVAILABLE" });
    } finally {
      console.error = originalError;
    }
  }, 30_000);
});
