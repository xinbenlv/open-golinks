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

  const email = `f13-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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

async function compatEdit(
  body: { golink: string; dest: string; addLogo?: boolean; caption?: string },
  token?: string,
) {
  touchedSlugs.add(body.golink);
  return app.request("/api/v2/edit", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? authHeaders(token) : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const links = await import("../../src/routes/api/links.ts");
  const compat = await import("../../src/routes/api/v2-compat.ts");
  const dbModule = await import("../../src/db/db.ts");

  db = dbModule.db;
  schema = dbModule.schema;

  app = new Hono();
  app.route("/api/v1/links", links.linksRoute);
  app.route("/api/v2", compat.v2CompatRoute);
});

afterAll(async () => {
  for (const slug of touchedSlugs) {
    await cleanupSlug(slug);
  }
  for (const userId of touchedUserIds) {
    await db.delete(schema.usersTable).where(eq(schema.usersTable.id, userId));
  }
});

describe("F13 Chrome extension API compatibility", () => {
  it("supports public v2 link lookup and availability checks", async () => {
    const slug = uniqueSlug("f13-public");
    const before = await app.request(`/api/v2/available/${slug}`);
    expect(before.status).toBe(200);
    expect(await before.json()).toBe(true);

    const created = await compatEdit({
      golink: slug,
      dest: "https://example.com/f13/public",
      addLogo: true,
      caption: "Launch",
    });
    expect(created.status).toBe(200);
    const createdBody = await created.json();
    expect(createdBody).toMatchObject({
      golink: slug,
      oldDest: "https://example.com/f13/public",
      author: "anonymous",
      addLogo: true,
      caption: "Launch",
      editable: false,
    });

    const after = await app.request(`/api/v2/available/${slug}`);
    expect(await after.json()).toBe(false);

    const lookup = await app.request(`/api/v2/link/${slug}`);
    expect(lookup.status).toBe(200);
    const body = await lookup.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      goLink: slug,
      goDest: "https://example.com/f13/public",
      author: "anonymous",
      addLogo: true,
      caption: "Launch",
      editable: false,
    });

    const v1Available = await app.request(`/api/v1/links/${slug}/available`);
    expect(v1Available.status).toBe(200);
    expect(await v1Available.json()).toEqual({ available: false });
  });

  it("keeps updates owner-only while supporting bearer-auth my-links", async () => {
    const ownerToken = await generateAccessToken("owner");
    const otherToken = await generateAccessToken("other");
    const owner = decodePayload(ownerToken);
    const slug = uniqueSlug("f13-owner");

    const created = await compatEdit(
      { golink: slug, dest: "https://example.com/f13/owner" },
      ownerToken,
    );
    expect(created.status).toBe(200);
    expect((await created.json()).author).toBe(owner.email);

    const forbidden = await compatEdit(
      { golink: slug, dest: "https://example.com/f13/forbidden" },
      otherToken,
    );
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({ error: "FORBIDDEN" });

    const updated = await compatEdit(
      {
        golink: slug,
        dest: "https://example.com/f13/updated",
        caption: "Updated",
      },
      ownerToken,
    );
    expect(updated.status).toBe(200);
    expect((await updated.json()).oldDest).toBe("https://example.com/f13/updated");

    const lookup = await app.request(`/api/v2/link/${slug}`, {
      headers: authHeaders(ownerToken),
    });
    const link = (await lookup.json())[0];
    expect(link.goDest).toBe("https://example.com/f13/updated");
    expect(link.author).toBe(owner.email);
    expect(link.editable).toBe(true);
    expect(link.destHistory).toEqual([
      expect.objectContaining({ dest: "https://example.com/f13/owner" }),
    ]);

    const myLinks = await app.request("/api/v2/my-links", {
      headers: authHeaders(ownerToken),
    });
    expect(myLinks.status).toBe(200);
    const myBody = await myLinks.json();
    expect(myBody.map((item: { goLink: string }) => item.goLink)).toContain(slug);

    const unauthMyLinks = await app.request("/api/v2/my-links");
    expect(unauthMyLinks.status).toBe(401);
  }, 30_000);
});
