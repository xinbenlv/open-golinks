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

  const email = `f11-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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
  if (!token) throw new Error("magic link did not return access_token");
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

async function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function ensureUser(token: string) {
  const res = await app.request("/api/v1/links?owner=me", {
    headers: await authHeaders(token),
  });
  expect(res.status).toBe(200);
}

async function postLink(slug: string, url: string, token: string) {
  touchedSlugs.add(slug);
  return app.request("/api/v1/links", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(await authHeaders(token)),
    },
    body: JSON.stringify({ slug, url }),
  });
}

async function transfer(slug: string, toEmail: string, token: string) {
  return app.request(`/api/v1/links/${slug}/transfer`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(await authHeaders(token)),
    },
    body: JSON.stringify({ toEmail }),
  });
}

async function ownerLinks(token: string, q: string) {
  const res = await app.request(`/api/v1/links?owner=me&q=${encodeURIComponent(q)}`, {
    headers: await authHeaders(token),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as { links: Array<{ slug: string }> };
}

beforeAll(async () => {
  const audit = await import("../../src/routes/api/audit.ts");
  const links = await import("../../src/routes/api/links.ts");
  const dbModule = await import("../../src/db/db.ts");

  db = dbModule.db;
  schema = dbModule.schema;

  app = new Hono();
  app.route("/api/v1/audit", audit.auditRoute);
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

describe("F11 ownership transfer", () => {
  it("transfers a link from owner A to registered user B and writes audit", async () => {
    const tokenA = await generateAccessToken("owner-a");
    const tokenB = await generateAccessToken("owner-b");
    const userA = decodePayload(tokenA);
    const userB = decodePayload(tokenB);
    await ensureUser(tokenB);

    const slug = uniqueSlug("f11-transfer");
    expect((await postLink(slug, "https://example.com/f11", tokenA)).status).toBe(201);

    const res = await transfer(slug, userB.email!, tokenA);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.link.ownerId).toBe(userB.sub);

    expect((await ownerLinks(tokenA, slug)).links).toEqual([]);
    expect((await ownerLinks(tokenB, slug)).links.map((link) => link.slug)).toContain(slug);

    const audit = await app.request(`/api/v1/audit/${slug}`, {
      headers: await authHeaders(tokenB),
    });
    expect(audit.status).toBe(200);
    const auditBody = await audit.json();
    const transferLog = auditBody.logs.find((log: { action: string }) => log.action === "TRANSFER");
    expect(transferLog.diff).toEqual({
      before: { ownerId: userA.sub },
      after: { ownerId: userB.sub },
    });
    expect(transferLog.metadata).toMatchObject({
      from_owner_id: userA.sub,
      to_owner_id: userB.sub,
    });
  }, 30_000);

  it("rejects missing recipients, self-transfer, and non-owner transfer", async () => {
    const tokenA = await generateAccessToken("errors-a");
    const tokenB = await generateAccessToken("errors-b");
    const userA = decodePayload(tokenA);
    await ensureUser(tokenB);
    const slug = uniqueSlug("f11-errors");
    expect((await postLink(slug, "https://example.com/f11-errors", tokenA)).status).toBe(201);

    const missing = await transfer(slug, "missing-f11@example.com", tokenA);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "USER_NOT_FOUND" });

    const self = await transfer(slug, userA.email!, tokenA);
    expect(self.status).toBe(400);
    expect(await self.json()).toEqual({ error: "SELF_TRANSFER" });

    const nonOwner = await transfer(slug, userA.email!, tokenB);
    expect(nonOwner.status).toBe(403);
    expect(await nonOwner.json()).toEqual({ error: "FORBIDDEN" });
  }, 30_000);
});
