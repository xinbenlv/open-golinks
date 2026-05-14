import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Hono as HonoType } from "hono";
import { normalizeUrlHistoryEntries } from "../../src/web/components/UrlHistory.tsx";

let app: HonoType;
let db: typeof import("../../src/db/db.ts").db;
let schema: typeof import("../../src/db/db.ts").schema;

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

  const email = `f10-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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

async function patchLink(slug: string, url: string, token: string) {
  return app.request(`/api/v1/links/${slug}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url }),
  });
}

async function getLink(slug: string) {
  return app.request(`/api/v1/links/${slug}`);
}

beforeAll(async () => {
  const links = await import("../../src/routes/api/links.ts");
  const dbModule = await import("../../src/db/db.ts");

  db = dbModule.db;
  schema = dbModule.schema;

  app = new Hono();
  app.route("/api/v1/links", links.linksRoute);
});

afterAll(async () => {
  for (const slug of touchedSlugs) {
    await cleanupSlug(slug);
  }
  for (const userId of touchedUserIds) {
    await db.delete(schema.usersTable).where(eq(schema.usersTable.id, userId));
  }
});

describe("F10 URL history", () => {
  it("records previous URLs in chronological storage order and normalizes newest first", async () => {
    const token = await generateAccessToken("chain");
    const slug = uniqueSlug("f10-chain");
    expect((await postLink(slug, "https://example.com/a", token)).status).toBe(201);
    expect((await patchLink(slug, "https://example.com/b", token)).status).toBe(200);
    expect((await patchLink(slug, "https://example.com/c", token)).status).toBe(200);

    const res = await getLink(slug);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.link.url).toBe("https://example.com/c");
    expect(body.link.urlHistory.map((entry: { url: string }) => entry.url)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
    const timeline = normalizeUrlHistoryEntries(body.link.urlHistory).reverse();
    expect(timeline.map((entry) => entry.url)).toEqual([
      "https://example.com/b",
      "https://example.com/a",
    ]);
    expect(timeline.every((entry) => entry.changedAt)).toBe(true);
  }, 30_000);

  it("keeps never-edited links empty", async () => {
    const token = await generateAccessToken("empty");
    const slug = uniqueSlug("f10-empty");
    expect((await postLink(slug, "https://example.com/only", token)).status).toBe(201);

    const res = await getLink(slug);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.link.urlHistory).toEqual([]);
    expect(normalizeUrlHistoryEntries(body.link.urlHistory)).toEqual([]);
  }, 30_000);

  it("normalizes malformed legacy url_history without throwing", () => {
    expect(normalizeUrlHistoryEntries({ bad: true })).toEqual([]);
    expect(
      normalizeUrlHistoryEntries([
        null,
        { href: "https://example.com/no-url" },
        { url: "https://example.com/snake", changed_at: "2026-05-13T00:00:00Z" },
        { url: 123 },
      ]),
    ).toEqual([
      {
        url: "https://example.com/snake",
        changedAt: "2026-05-13T00:00:00Z",
        changedBy: null,
      },
    ]);
  });
});
