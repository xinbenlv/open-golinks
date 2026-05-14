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

  const email = `f9-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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

async function postLink(slug: string, url: string, token?: string, headers = {}) {
  touchedSlugs.add(slug);
  return app.request("/api/v1/links", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
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

async function claimLink(slug: string, fingerprint: string, token: string) {
  return app.request(`/api/v1/links/${slug}/claim`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fingerprint }),
  });
}

async function getAudit(slug: string, token: string, query = "") {
  return app.request(`/api/v1/audit/${slug}${query}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

async function pause() {
  await new Promise((resolve) => setTimeout(resolve, 20));
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

describe("F9 audit log view", () => {
  it("lets the owner read CREATE, CLAIM, and UPDATE audit entries with diff", async () => {
    const token = await generateAccessToken("timeline");
    const user = decodePayload(token);
    const slug = uniqueSlug("f9-audit");
    const fingerprint = "a".repeat(64);

    expect(
      (await postLink(slug, "https://example.com/old", undefined, {
        "x-fingerprint": fingerprint,
        "x-forwarded-for": "203.0.113.91",
        "user-agent": "f9-audit",
      })).status,
    ).toBe(201);
    await pause();
    expect((await claimLink(slug, fingerprint, token)).status).toBe(200);
    await pause();
    expect((await patchLink(slug, "https://example.com/new", token)).status).toBe(200);

    const res = await getAudit(slug, token);
    expect(res.status).toBe(200);
    const body = await res.json();
    const actions = body.logs.map((log: { action: string }) => log.action);
    expect(actions.slice(0, 3)).toEqual(["UPDATE", "CLAIM", "CREATE"]);

    const update = body.logs.find((log: { action: string }) => log.action === "UPDATE");
    expect(update.actorEmail).toBe(user.email);
    expect(update.diff).toEqual({
      before: { url: "https://example.com/old" },
      after: { url: "https://example.com/new" },
    });

    const create = body.logs.find((log: { action: string }) => log.action === "CREATE");
    expect(create.actorEmail).toBeNull();
    expect(create.actorFingerprint).toBe(fingerprint);
  }, 30_000);

  it("rejects non-owner reads and returns 404 for missing slugs", async () => {
    const ownerToken = await generateAccessToken("owner");
    const otherToken = await generateAccessToken("other");
    const slug = uniqueSlug("f9-private");
    expect((await postLink(slug, "https://example.com/private", ownerToken)).status).toBe(201);

    const foreign = await getAudit(slug, otherToken);
    expect(foreign.status).toBe(403);
    expect(await foreign.json()).toEqual({ error: "FORBIDDEN" });

    const missing = await getAudit(uniqueSlug("f9-missing"), ownerToken);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "NOT_FOUND" });
  }, 30_000);

  it("paginates audit logs with a timestamp/id cursor", async () => {
    const token = await generateAccessToken("pagination");
    const user = decodePayload(token);
    const slug = uniqueSlug("f9-page");
    expect((await postLink(slug, "https://example.com/page", token)).status).toBe(201);
    await db
      .delete(schema.auditLogsTable)
      .where(eq(schema.auditLogsTable.linkSlug, slug));

    const base = Date.now();
    await db.insert(schema.auditLogsTable).values(
      Array.from({ length: 25 }, (_, index) => ({
        linkSlug: slug,
        actorId: user.sub,
        actorIpHash: "b".repeat(64),
        action: "UPDATE" as const,
        diff: { after: { index } },
        timestamp: new Date(base + index * 1000),
      })),
    );

    const first = await getAudit(slug, token, "?limit=20");
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.logs).toHaveLength(20);
    expect(firstBody.logs[0].diff.after.index).toBe(24);
    expect(firstBody.nextCursor).toBeTruthy();

    const second = await getAudit(
      slug,
      token,
      `?limit=20&cursor=${encodeURIComponent(firstBody.nextCursor)}`,
    );
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.logs).toHaveLength(5);
    expect(secondBody.logs[0].diff.after.index).toBe(4);
    expect(secondBody.nextCursor).toBeNull();

    const invalid = await getAudit(slug, token, "?cursor=not-a-cursor");
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "INVALID_CURSOR" });
  }, 30_000);
});
