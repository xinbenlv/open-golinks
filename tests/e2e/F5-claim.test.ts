import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Hono as HonoType } from "hono";

let app: HonoType;
let db: typeof import("../../src/db/db.ts").db;
let schema: typeof import("../../src/db/db.ts").schema;

const touchedSlugs = new Set<string>();
const touchedUserIds = new Set<string>();

const FP_A = "a".repeat(64);
const FP_B = "b".repeat(64);

function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 48);
}

function decodeSub(token: string): string {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("JWT payload missing");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).sub;
}

async function generateAuth(label: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secret) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");
  }

  const email = `f5-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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
  const userId = decodeSub(token);
  touchedUserIds.add(userId);
  return { token, email, userId };
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

async function anonymousCreate(slug: string, fingerprint: string) {
  touchedSlugs.add(slug);
  return app.request("/api/v1/links", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-fingerprint": fingerprint,
      "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200)}`,
      "user-agent": `f5-anon-${slug}`,
    },
    body: JSON.stringify({ slug, url: `https://example.com/${slug}` }),
  });
}

async function claim(slug: string, token: string, fingerprint?: string) {
  return app.request(`/api/v1/links/${slug}/claim`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(fingerprint ? { fingerprint } : {}),
  });
}

async function claimable(token: string, fingerprint?: string) {
  const suffix = fingerprint ? `?fingerprint=${fingerprint}` : "";
  return app.request(`/api/v1/links/claimable${suffix}`, {
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

describe("F5 anonymous claim", () => {
  it("claims an anonymous fingerprinted link and writes CLAIM audit", async () => {
    const slug = uniqueSlug("f5-claim");
    await cleanupSlug(slug);
    expect((await anonymousCreate(slug, FP_A)).status).toBe(201);
    const auth = await generateAuth("claim");

    const list = await claimable(auth.token, FP_A);
    expect(list.status).toBe(200);
    const claimableBody = await list.json();
    expect(claimableBody.links.map((link: { slug: string }) => link.slug)).toContain(slug);

    const res = await claim(slug, auth.token, FP_A);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.link.ownerId).toBe(auth.userId);

    const auditRows = await db
      .select({ action: schema.auditLogsTable.action })
      .from(schema.auditLogsTable)
      .where(eq(schema.auditLogsTable.linkSlug, slug));
    expect(auditRows.map((row) => row.action)).toContain("CLAIM");
  }, 30_000);

  it("rejects mismatched fingerprints and already-owned links", async () => {
    const slug = uniqueSlug("f5-mismatch");
    await cleanupSlug(slug);
    expect((await anonymousCreate(slug, FP_A)).status).toBe(201);
    const auth = await generateAuth("mismatch");

    const bad = await claim(slug, auth.token, FP_B);
    expect(bad.status).toBe(403);
    expect(await bad.json()).toEqual({ error: "CLAIM_FORBIDDEN" });

    expect((await claim(slug, auth.token, FP_A)).status).toBe(200);
    const again = await claim(slug, auth.token, FP_A);
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "ALREADY_OWNED" });
  }, 30_000);

  it("supports legacy_author_email claim without exposing unrelated links", async () => {
    const auth = await generateAuth("legacy");
    const ownedSlug = uniqueSlug("f5-legacy-ok");
    const otherSlug = uniqueSlug("f5-legacy-no");
    await cleanupSlug(ownedSlug);
    await cleanupSlug(otherSlug);
    touchedSlugs.add(ownedSlug);
    touchedSlugs.add(otherSlug);
    await db.insert(schema.linksTable).values({
      slug: ownedSlug,
      url: "https://example.com/legacy-ok",
      metadata: { legacy_author_email: auth.email.toUpperCase() },
      urlHistory: [],
    });
    await db.insert(schema.linksTable).values({
      slug: otherSlug,
      url: "https://example.com/legacy-no",
      metadata: { legacy_author_email: "someone-else@example.com" },
      urlHistory: [],
    });

    const publicLookup = await app.request(`/api/v1/links/${ownedSlug}`);
    expect(publicLookup.status).toBe(200);
    const publicBody = await publicLookup.json();
    expect(publicBody.link.metadata).not.toHaveProperty("legacy_author_email");

    const list = await claimable(auth.token);
    expect(list.status).toBe(200);
    const body = await list.json();
    const slugs = body.links.map((link: { slug: string }) => link.slug);
    expect(slugs).toContain(ownedSlug);
    expect(slugs).not.toContain(otherSlug);

    const res = await claim(ownedSlug, auth.token);
    expect(res.status).toBe(200);
    const claimed = await res.json();
    expect(claimed.link.ownerId).toBe(auth.userId);
    expect(claimed.link.metadata).not.toHaveProperty("legacy_author_email");

    const forbidden = await claim(otherSlug, auth.token);
    expect(forbidden.status).toBe(403);
  }, 30_000);

  it("allows only one winner for concurrent claim attempts", async () => {
    const slug = uniqueSlug("f5-race");
    await cleanupSlug(slug);
    expect((await anonymousCreate(slug, FP_A)).status).toBe(201);
    const authA = await generateAuth("race-a");
    const authB = await generateAuth("race-b");

    const results = await Promise.all([
      claim(slug, authA.token, FP_A),
      claim(slug, authB.token, FP_A),
    ]);
    const statuses = results.map((res) => res.status).sort();
    expect(statuses).toEqual([200, 409]);

    const [row] = await db
      .select({ ownerId: schema.linksTable.ownerId })
      .from(schema.linksTable)
      .where(eq(schema.linksTable.slug, slug))
      .limit(1);
    expect([authA.userId, authB.userId]).toContain(row?.ownerId);
  }, 30_000);

  it("rejects invalid fingerprint input", async () => {
    const auth = await generateAuth("bad-fp");
    const res = await claimable(auth.token, "not-a-fingerprint");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_FINGERPRINT" });
  }, 30_000);
});
