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

  const email = `f6-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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

async function createOwnedLink(slug: string, token: string, url: string) {
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

async function patchLink(slug: string, token: string, body: unknown) {
  return app.request(`/api/v1/links/${slug}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const links = await import("../../src/routes/api/links.ts");
  const redirect = await import("../../src/routes/redirect.ts");
  const warn = await import("../../src/routes/warn.ts");
  const dbModule = await import("../../src/db/db.ts");

  db = dbModule.db;
  schema = dbModule.schema;

  app = new Hono();
  app.route("/api/v1/links", links.linksRoute);
  app.route("/warn", warn.warnRoute);
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

describe("F6 warning interstitial", () => {
  it("intercepts warned links, serves self-contained HTML, and proceeds on confirm", async () => {
    const token = await generateAccessToken("warn");
    const slug = uniqueSlug("f6-warn");
    const targetUrl = `https://example.com/f6/${slug}?x=%3Ctag%3E&next=1`;
    await cleanupSlug(slug);

    expect((await createOwnedLink(slug, token, targetUrl)).status).toBe(201);
    const enable = await patchLink(slug, token, {
      metadata: { show_warning: true },
    });
    expect(enable.status).toBe(200);
    expect((await enable.json()).link.metadata.show_warning).toBe(true);

    const intercepted = await app.request(`/${slug}`);
    expect(intercepted.status).toBe(302);
    expect(intercepted.headers.get("location")).toBe(`/warn/${slug}`);

    const page = await app.request(`/warn/${slug}`);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    const html = await page.text();
    expect(html).toContain("即将跳转外部链接");
    expect(html).toContain("继续访问 Proceed");
    expect(html).toContain("取消 Cancel");
    expect(html).toContain("https://example.com/f6/");
    expect(html).toContain("&amp;next=1");
    expect(html).not.toContain("<script");

    const proceed = await app.request(`/${slug}?confirm=1`);
    expect(proceed.status).toBe(302);
    expect(proceed.headers.get("location")).toBe(targetUrl);

    const disable = await patchLink(slug, token, {
      metadata: { show_warning: false },
    });
    expect(disable.status).toBe(200);
    expect((await disable.json()).link.metadata.show_warning).toBe(false);
    const direct = await app.request(`/${slug}`);
    expect(direct.status).toBe(302);
    expect(direct.headers.get("location")).toBe(targetUrl);
  }, 30_000);

  it("keeps metadata.show_warning boolean validation strict", async () => {
    const token = await generateAccessToken("metadata");
    const slug = uniqueSlug("f6-meta");
    await cleanupSlug(slug);
    expect((await createOwnedLink(slug, token, "https://example.com/f6/meta")).status).toBe(201);

    const unknownKey = await patchLink(slug, token, {
      metadata: { show_warning: true, ownerId: "blocked" },
    });
    expect(unknownKey.status).toBe(400);

    const wrongType = await patchLink(slug, token, {
      metadata: { show_warning: "yes" },
    });
    expect(wrongType.status).toBe(400);

    const empty = await patchLink(slug, token, {});
    expect(empty.status).toBe(400);
  }, 30_000);

  it("returns 404 for missing and deleted warning pages", async () => {
    const missing = await app.request(`/warn/${uniqueSlug("f6-missing")}`);
    expect(missing.status).toBe(404);

    const token = await generateAccessToken("deleted");
    const slug = uniqueSlug("f6-deleted");
    await cleanupSlug(slug);
    expect((await createOwnedLink(slug, token, "https://example.com/f6/deleted")).status).toBe(201);
    const deleted = await app.request(`/api/v1/links/${slug}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deleted.status).toBe(204);

    const page = await app.request(`/warn/${slug}`);
    expect(page.status).toBe(404);
  }, 30_000);
});
