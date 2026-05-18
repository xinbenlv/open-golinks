import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Hono as HonoType } from "hono";

let app: HonoType;
let db: typeof import("../../src/db/db.ts").db;
let schema: typeof import("../../src/db/db.ts").schema;
let resetRateLimitForTests: () => void;

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

  const email = `f2-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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

async function postLink(
  slug: string,
  url: string,
  token?: string,
  headers = {},
  body: Record<string, unknown> = {},
) {
  touchedSlugs.add(slug);
  return app.request("/api/v1/links", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: JSON.stringify({ slug, url, ...body }),
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

async function deleteLink(slug: string, token: string) {
  return app.request(`/api/v1/links/${slug}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
}

async function auditActions(slug: string) {
  const rows = await db
    .select({ action: schema.auditLogsTable.action })
    .from(schema.auditLogsTable)
    .where(eq(schema.auditLogsTable.linkSlug, slug));
  return rows.map((row) => row.action).sort();
}

beforeAll(async () => {
  const links = await import("../../src/routes/api/links.ts");
  const redirect = await import("../../src/routes/redirect.ts");
  const dbModule = await import("../../src/db/db.ts");
  const rateLimit = await import("../../src/middleware/ratelimit.ts");

  db = dbModule.db;
  schema = dbModule.schema;
  resetRateLimitForTests = rateLimit.resetRateLimitForTests;

  app = new Hono();
  app.route("/api/v1/links", links.linksRoute);
  app.route("/", redirect.redirectRoute);
});

afterAll(async () => {
  for (const slug of touchedSlugs) {
    await cleanupSlug(slug);
  }
  for (const userId of touchedUserIds) {
    await db.delete(schema.usersTable).where(eq(schema.usersTable.id, userId));
  }
});

describe("F2 link CRUD + audit + rate limit", () => {
  it("runs owner CRUD, records url_history, and writes CREATE/UPDATE/DELETE audit rows", async () => {
    const token = await generateAccessToken("owner-crud");
    const userId = decodeSub(token);
    const slug = uniqueSlug("f2-crud");
    await cleanupSlug(slug);

    const create = await postLink(slug, "https://example.com/a", token);
    expect(create.status).toBe(201);
    const created = await create.json();
    expect(created.link.ownerId).toBe(userId);

    const patch = await patchLink(slug, "https://example.com/b", token);
    expect(patch.status).toBe(200);
    const patched = await patch.json();
    expect(patched.link.url).toBe("https://example.com/b");
    expect(patched.link.urlHistory.at(-1)).toMatchObject({
      url: "https://example.com/a",
      changedBy: userId,
    });

    const redirect = await app.request(`/${slug}`);
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("location")).toBe("https://example.com/b");

    const deleted = await deleteLink(slug, token);
    expect(deleted.status).toBe(204);
    const deletedRedirect = await app.request(`/${slug}`);
    expect(deletedRedirect.status).toBe(404);

    expect(await auditActions(slug)).toEqual(["CREATE", "DELETE", "UPDATE"]);
  }, 30_000);

  it("rejects PATCH and DELETE from a non-owner", async () => {
    const ownerToken = await generateAccessToken("owner");
    const otherToken = await generateAccessToken("other");
    const slug = uniqueSlug("f2-foreign");
    await cleanupSlug(slug);

    const create = await postLink(slug, "https://example.com/owner", ownerToken);
    expect(create.status).toBe(201);

    const patch = await patchLink(slug, "https://example.com/nope", otherToken);
    expect(patch.status).toBe(403);
    const deleted = await deleteLink(slug, otherToken);
    expect(deleted.status).toBe(403);
  }, 30_000);

  it("persists public discovery and QR settings through PATCH", async () => {
    const token = await generateAccessToken("public-qr");
    const slug = uniqueSlug("f2-public-qr");
    await cleanupSlug(slug);

    expect((await postLink(slug, "https://example.com/public-qr", token)).status).toBe(201);

    const patch = await app.request(`/api/v1/links/${slug}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        isPublic: true,
        metadata: {
          show_warning: true,
          addLogo: false,
          caption: "Launch handout",
        },
      }),
    });

    expect(patch.status).toBe(200);
    const body = await patch.json();
    expect(body.link.isPublic).toBe(true);
    expect(body.link.metadata).toMatchObject({
      show_warning: true,
      addLogo: false,
      caption: "Launch handout",
    });
  }, 30_000);

  it("allows the same owner to recreate a soft-deleted slug", async () => {
    const token = await generateAccessToken("restore-owner");
    const slug = uniqueSlug("f2-restore");
    await cleanupSlug(slug);

    expect((await postLink(slug, "https://example.com/old", token)).status).toBe(201);
    expect((await deleteLink(slug, token)).status).toBe(204);

    const restored = await postLink(slug, "https://example.com/new", token);
    expect(restored.status).toBe(201);
    const body = await restored.json();
    expect(body.link.url).toBe("https://example.com/new");
    expect(body.link.deletedAt).toBeNull();
    expect(body.link.urlHistory).toEqual([]);

    const redirect = await app.request(`/${slug}`);
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("location")).toBe("https://example.com/new");
  }, 30_000);

  it("does not allow a different owner to recreate a soft-deleted slug", async () => {
    const ownerToken = await generateAccessToken("restore-owner-a");
    const otherToken = await generateAccessToken("restore-owner-b");
    const slug = uniqueSlug("f2-steal");
    await cleanupSlug(slug);

    expect((await postLink(slug, "https://example.com/old", ownerToken)).status).toBe(201);
    expect((await deleteLink(slug, ownerToken)).status).toBe(204);

    const stolen = await postLink(slug, "https://example.com/new", otherToken);
    expect(stolen.status).toBe(409);
    expect(await stolen.json()).toEqual({ error: "SLUG_TAKEN" });
  }, 30_000);

  it("rate-limits the sixth anonymous POST in one minute", async () => {
    resetRateLimitForTests();
    const headers = {
      "x-forwarded-for": "203.0.113.20",
      "user-agent": "f2-anon-rate-limit",
    };

    for (let i = 0; i < 5; i += 1) {
      const res = await postLink(
        uniqueSlug(`f2-rl-${i}`),
        `https://example.com/${i}`,
        undefined,
        headers,
      );
      expect(res.status).toBe(201);
    }

    const limited = await postLink(
      uniqueSlug("f2-rl-5"),
      "https://example.com/5",
      undefined,
      headers,
    );
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "RATE_LIMITED" });
    expect(limited.headers.get("retry-after")).toBeTruthy();
  }, 30_000);

  it("does not rate-limit authenticated POSTs and preserves owner_id", async () => {
    resetRateLimitForTests();
    const token = await generateAccessToken("auth-rate-bypass");
    const userId = decodeSub(token);
    const headers = {
      "x-forwarded-for": "203.0.113.30",
      "user-agent": "f2-auth-rate-bypass",
    };

    for (let i = 0; i < 6; i += 1) {
      const slug = uniqueSlug(`f2-auth-${i}`);
      const res = await postLink(slug, `https://example.com/auth/${i}`, token, headers);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.link.ownerId).toBe(userId);
    }
  }, 30_000);

  it("forces anonymous creates to stay public and warned until claimed", async () => {
    resetRateLimitForTests();
    const slug = uniqueSlug("f2-anon-owner");
    await cleanupSlug(slug);

    const res = await postLink(
      slug,
      "https://example.com/anonymous",
      undefined,
      {
        "x-forwarded-for": "203.0.113.40",
        "user-agent": "f2-anon-owner",
      },
      {
        isPublic: false,
        metadata: { show_warning: false },
      },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.link.ownerId).toBeNull();
    expect(body.link.isPublic).toBe(true);
    expect(body.link.metadata.show_warning).toBe(true);
  }, 30_000);
});
