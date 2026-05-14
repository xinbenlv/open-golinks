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
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${suffix}`.slice(0, 48);
}

function decodePayload(token: string): { sub: string; email?: string } {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("JWT payload missing");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

async function generateAccessToken(label: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secret) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");
  }

  const email = `f12-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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
  const data = (await res.json()) as { email_otp?: string };
  if (!res.ok || !data.email_otp) {
    throw new Error(`generate_link failed: ${res.status}`);
  }
  const verify = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/verify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: secret,
    },
    body: JSON.stringify({ type: "email", email, token: data.email_otp }),
  });
  const verified = (await verify.json()) as { access_token?: string };
  const token = verified.access_token;
  if (!token) throw new Error(`verify failed: ${verify.status}`);
  touchedUserIds.add(decodePayload(token).sub);
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

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function postLink(slug: string, url: string, token: string) {
  touchedSlugs.add(slug);
  return app.request("/api/v1/links", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ slug, url }),
  });
}

async function ownerList(token: string, params = new URLSearchParams()) {
  return app.request(`/api/v1/links?${params.toString()}`, {
    headers: authHeaders(token),
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

describe("F12 public browse drop", () => {
  it("requires auth for the links list and rejects owner=public", async () => {
    const unauthenticated = await app.request("/api/v1/links");
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toEqual({ error: "UNAUTHORIZED" });

    const token = await generateAccessToken("owner-list");
    const owner = await ownerList(token);
    expect(owner.status).toBe(200);

    const publicList = await app.request("/api/v1/links?owner=public", {
      headers: authHeaders(token),
    });
    expect(publicList.status).toBe(400);
    const body = await publicList.json();
    expect(body.error).toBe("INVALID_INPUT");
  }, 30_000);

  it("lists only current-owner links and creates/restores links as private", async () => {
    const tokenA = await generateAccessToken("owner-a");
    const tokenB = await generateAccessToken("owner-b");
    const slugA = uniqueSlug("f12-owned");
    const slugB = uniqueSlug("f12-other");

    const createdA = await postLink(slugA, "https://example.com/f12/owned", tokenA);
    expect(createdA.status).toBe(201);
    expect((await createdA.json()).link.isPublic).toBe(false);

    const createdB = await postLink(slugB, "https://example.com/f12/other", tokenB);
    expect(createdB.status).toBe(201);
    await db
      .update(schema.linksTable)
      .set({ isPublic: true })
      .where(eq(schema.linksTable.slug, slugB));

    const ownerA = await ownerList(tokenA, new URLSearchParams({ q: slugA }));
    expect(ownerA.status).toBe(200);
    const ownerABody = await ownerA.json();
    expect(ownerABody.links.map((link: { slug: string }) => link.slug)).toContain(slugA);

    const otherPublic = await ownerList(tokenA, new URLSearchParams({ q: slugB }));
    expect(otherPublic.status).toBe(200);
    expect((await otherPublic.json()).links).toEqual([]);

    const deleted = await app.request(`/api/v1/links/${slugA}`, {
      method: "DELETE",
      headers: authHeaders(tokenA),
    });
    expect(deleted.status).toBe(204);

    const restored = await postLink(slugA, "https://example.com/f12/restored", tokenA);
    expect(restored.status).toBe(201);
    expect((await restored.json()).link.isPublic).toBe(false);
  }, 30_000);
});
