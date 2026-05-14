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

  const email = `f14-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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

async function postLink(
  slug: string,
  token: string,
  metadata?: Record<string, unknown>,
) {
  touchedSlugs.add(slug);
  return app.request("/api/v1/links", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({
      slug,
      url: `https://example.com/f14/${slug}`,
      metadata,
    }),
  });
}

async function patchLink(
  slug: string,
  token: string,
  metadata: Record<string, unknown>,
) {
  return app.request(`/api/v1/links/${slug}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ metadata }),
  });
}

async function ownerList(token: string, tag?: string) {
  const params = new URLSearchParams({ owner: "me", limit: "50" });
  if (tag) params.set("tag", tag);
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

describe("F14 link metadata", () => {
  it("stores metadata, preserves show_warning, and filters owner links by tag", async () => {
    const token = await generateAccessToken("metadata");
    const workSlug = uniqueSlug("f14-work");
    const personalSlug = uniqueSlug("f14-personal");

    const created = await postLink(workSlug, token, {
      description: "Initial",
      tags: ["draft"],
      show_warning: true,
    });
    expect(created.status).toBe(201);
    expect((await created.json()).link.metadata).toMatchObject({
      description: "Initial",
      tags: ["draft"],
      show_warning: true,
    });

    const updated = await patchLink(workSlug, token, {
      description: "TPS report",
      tags: ["work", "urgent"],
    });
    expect(updated.status).toBe(200);
    expect((await updated.json()).link.metadata).toEqual({
      description: "TPS report",
      tags: ["work", "urgent"],
      show_warning: true,
    });

    expect(
      (await postLink(personalSlug, token, {
        description: "Weekend",
        tags: ["personal"],
      })).status,
    ).toBe(201);

    const work = await ownerList(token, "work");
    expect(work.status).toBe(200);
    const workBody = await work.json();
    expect(workBody.links.map((link: { slug: string }) => link.slug)).toContain(workSlug);
    expect(workBody.links.map((link: { slug: string }) => link.slug)).not.toContain(personalSlug);

    const cleared = await patchLink(workSlug, token, { tags: [] });
    expect(cleared.status).toBe(200);
    expect((await cleared.json()).link.metadata.tags).toEqual([]);

    const afterClear = await ownerList(token, "work");
    expect((await afterClear.json()).links.map((link: { slug: string }) => link.slug)).not.toContain(workSlug);
  }, 30_000);

  it("rejects invalid metadata keys and limits", async () => {
    const token = await generateAccessToken("invalid");
    const slug = uniqueSlug("f14-invalid");
    expect((await postLink(slug, token)).status).toBe(201);

    const tooManyTags = await patchLink(slug, token, {
      tags: Array.from({ length: 11 }, (_, index) => `tag${index}`),
    });
    expect(tooManyTags.status).toBe(400);

    const longTag = await patchLink(slug, token, {
      tags: ["x".repeat(21)],
    });
    expect(longTag.status).toBe(400);

    const longDescription = await patchLink(slug, token, {
      description: "x".repeat(281),
    });
    expect(longDescription.status).toBe(400);

    const unknownKey = await patchLink(slug, token, {
      ownerId: "nope",
    });
    expect(unknownKey.status).toBe(400);
  }, 30_000);
});
