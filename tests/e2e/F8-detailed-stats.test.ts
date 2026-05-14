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

function uniqueSlug(prefix: string) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${suffix}`.slice(0, 48);
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

async function insertLink(slug: string, url: string, deletedAt?: Date) {
  touchedSlugs.add(slug);
  await cleanupSlug(slug);
  await db.insert(schema.linksTable).values({
    slug,
    url,
    urlHistory: [],
    deletedAt,
  });
}

async function postStatsQuery(body: Record<string, unknown>) {
  return app.request("/api/v1/stats/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
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
  const stats = await import("../../src/routes/api/stats.ts");
  const dbModule = await import("../../src/db/db.ts");
  const ga4 = await import("../../src/lib/ga4.ts");

  db = dbModule.db;
  schema = dbModule.schema;
  setStatsQueryProviderForTests = ga4.setStatsQueryProviderForTests;

  app = new Hono();
  app.route("/api/v1/stats", stats.statsRoute);
});

beforeEach(() => {
  setStatsQueryProviderForTests(null);
});

afterAll(async () => {
  setStatsQueryProviderForTests(null);
  for (const slug of touchedSlugs) {
    await cleanupSlug(slug);
  }
});

describe("F8 detailed stats", () => {
  it("allows public aggregate stats queries across all non-deleted links", async () => {
    const slugA = uniqueSlug("f8-owned");
    const slugB = uniqueSlug("f8-other");
    const deletedSlug = uniqueSlug("f8-deleted");
    await insertLink(slugA, "https://example.com/a");
    await insertLink(slugB, "https://example.com/b");
    await insertLink(deletedSlug, "https://example.com/deleted", new Date());

    let captured: StatsQueryInput | null = null;
    setStatsQueryProviderForTests(async (input) => {
      captured = input;
      return result(input, [
        { dimension: `/${slugA}?utm=one`, eventCount: 9, activeUsers: 4 },
      ]);
    });

    const res = await postStatsQuery({
      range: 30,
      groupBy: "path",
      limit: 5,
      pathRegex: `^/${slugA}`,
      usePathPlusQueryString: true,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(captured?.allLinks).toBe(true);
    expect(captured?.slugs).toContain(slugA);
    expect(captured?.slugs).toContain(slugB);
    expect(captured?.slugs).not.toContain(deletedSlug);
    expect(captured).toMatchObject({
      range: 30,
      groupBy: "path",
      limit: 5,
      pathRegex: `^/${slugA}`,
      usePathPlusQueryString: true,
    });
    expect(body.dimension).toBe("pagePathPlusQueryString");
    expect(body.rows[0]).toMatchObject({ eventCount: 9, activeUsers: 4 });
  });

  it("supports public slug date queries and hides missing or deleted slugs", async () => {
    const slug = uniqueSlug("f8-date");
    const deletedSlug = uniqueSlug("f8-date-del");
    await insertLink(slug, "https://example.com/date");
    await insertLink(deletedSlug, "https://example.com/date-deleted", new Date());

    let captured: StatsQueryInput | null = null;
    setStatsQueryProviderForTests(async (input) => {
      captured = input;
      return result(input, [
        { dimension: "2026-05-13", eventCount: 3, activeUsers: 2 },
      ]);
    });

    const owned = await postStatsQuery({
      slug,
      range: 7,
      groupBy: "date",
      limit: 7,
    });
    expect(owned.status).toBe(200);
    const body = await owned.json();
    expect(captured?.allLinks).toBe(false);
    expect(captured?.slugs).toEqual([slug]);
    expect(body.dimension).toBe("date");
    expect(body.rows[0].dimension).toBe("2026-05-13");

    const missing = await postStatsQuery({
      slug: uniqueSlug("f8-missing"),
      range: 7,
      groupBy: "path",
      limit: 10,
    });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "NOT_FOUND" });

    const deleted = await postStatsQuery({
      slug: deletedSlug,
      range: 7,
      groupBy: "path",
      limit: 10,
    });
    expect(deleted.status).toBe(404);
    expect(await deleted.json()).toEqual({ error: "NOT_FOUND" });
  });

  it("rejects unsupported query shapes", async () => {
    expect((await postStatsQuery({ range: 14 })).status).toBe(400);
    expect((await postStatsQuery({ limit: 181 })).status).toBe(400);
    expect(
      (await postStatsQuery({ pathRegex: "x".repeat(181) })).status,
    ).toBe(400);
  });

  it("returns 500 when the stats query provider fails", async () => {
    const slug = uniqueSlug("f8-fail");
    await insertLink(slug, "https://example.com/fail");
    setStatsQueryProviderForTests(async () => {
      throw new Error("GA4 down");
    });

    const originalError = console.error;
    console.error = () => undefined;
    try {
      const res = await postStatsQuery({
        slug,
        range: 7,
        groupBy: "path",
        limit: 10,
      });
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "STATS_UNAVAILABLE" });
    } finally {
      console.error = originalError;
    }
  });
});
