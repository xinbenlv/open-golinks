import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Hono as HonoType } from "hono";

let app: HonoType;
let db: typeof import("../../src/db/db.ts").db;
let schema: typeof import("../../src/db/db.ts").schema;

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

  const email = `f3-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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

async function ownerList(token: string, params = new URLSearchParams()) {
  params.set("owner", "me");
  return app.request(`/api/v1/links?${params.toString()}`, {
    headers: { authorization: `Bearer ${token}` },
  });
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

describe("F3 owner dashboard API", () => {
  it("requires auth for owner=me", async () => {
    const res = await app.request("/api/v1/links?owner=me");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "UNAUTHORIZED" });
  });

  it("paginates owner links with a cursor", async () => {
    const token = await generateAccessToken("paginate");
    for (let i = 0; i < 22; i += 1) {
      const slug = uniqueSlug(`f3-page-${String(i).padStart(2, "0")}`);
      const res = await postLink(slug, `https://example.com/f3/page/${i}`, token);
      expect(res.status).toBe(201);
    }

    const first = await ownerList(
      token,
      new URLSearchParams({ limit: "20", q: "f3-page" }),
    );
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.links).toHaveLength(20);
    expect(firstBody.nextCursor).toBeTruthy();

    const second = await ownerList(
      token,
      new URLSearchParams({
        limit: "20",
        q: "f3-page",
        cursor: firstBody.nextCursor,
      }),
    );
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.links.length).toBeGreaterThanOrEqual(2);
    const firstSlugs = new Set(firstBody.links.map((link: { slug: string }) => link.slug));
    for (const link of secondBody.links as Array<{ slug: string }>) {
      expect(firstSlugs.has(link.slug)).toBe(false);
    }
  }, 45_000);

  it("searches owner links by slug and URL", async () => {
    const token = await generateAccessToken("search");
    const slugMatch = uniqueSlug("f3-needle");
    const urlMatch = uniqueSlug("f3-url");
    expect((await postLink(slugMatch, "https://example.com/plain", token)).status).toBe(201);
    expect((await postLink(urlMatch, "https://example.com/path/f3needle", token)).status).toBe(201);

    const res = await ownerList(token, new URLSearchParams({ q: "f3needle" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const slugs = body.links.map((link: { slug: string }) => link.slug);
    expect(slugs).toContain(urlMatch);

    const slugRes = await ownerList(token, new URLSearchParams({ q: "f3-needle" }));
    expect(slugRes.status).toBe(200);
    const slugBody = await slugRes.json();
    expect(slugBody.links.map((link: { slug: string }) => link.slug)).toContain(slugMatch);
  }, 30_000);
});
