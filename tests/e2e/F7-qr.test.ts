import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Hono as HonoType } from "hono";

let app: HonoType;
let db: typeof import("../../src/db/db.ts").db;
let schema: typeof import("../../src/db/db.ts").schema;

const touchedSlugs = new Set<string>();
const SPA_SENTINEL = "SPA_FALLBACK";

function uniqueSlug(prefix: string) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${suffix}`.slice(0, 48);
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

async function insertLink(slug: string, url = `https://example.com/${slug}`) {
  touchedSlugs.add(slug);
  await cleanupSlug(slug);
  await db.insert(schema.linksTable).values({
    slug,
    url,
    urlHistory: [],
  });
}

async function pngBytes(res: Response) {
  return new Uint8Array(await res.arrayBuffer());
}

function expectPng(bytes: Uint8Array) {
  expect(Array.from(bytes.slice(0, 8))).toEqual([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
  ]);
  expect(bytes.byteLength).toBeGreaterThan(1000);
}

beforeAll(async () => {
  const links = await import("../../src/routes/api/links.ts");
  const qrApi = await import("../../src/routes/api/qr.ts");
  const qr = await import("../../src/routes/qr.ts");
  const redirect = await import("../../src/routes/redirect.ts");
  const dbModule = await import("../../src/db/db.ts");

  db = dbModule.db;
  schema = dbModule.schema;

  app = new Hono();
  app.route("/api/v1/links", links.linksRoute);
  app.route("/api/v1/qr", qrApi.qrApiRoute);
  app.route("/qr", qr.qrRoute);
  app.route("/", redirect.redirectRoute);
  app.get("*", (c) => c.text(SPA_SENTINEL));
});

afterAll(async () => {
  for (const slug of touchedSlugs) {
    await cleanupSlug(slug);
  }
});

describe("F7 QR codes", () => {
  it("returns PNG from API with CJK caption and optional logo", async () => {
    const slug = uniqueSlug("f7-api");
    await insertLink(slug);

    const res = await app.request(
      `/api/v1/qr/${slug}?caption=${encodeURIComponent("测试中文")}&logo=true`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/png");
    expectPng(await pngBytes(res));
  });

  it("supports master-compatible inline and download PNG paths", async () => {
    const slug = uniqueSlug("f7-compat");
    await insertLink(slug);

    const inline = await app.request(`/qr/${slug}.png?caption=hello&addLogo=true`);
    expect(inline.status).toBe(200);
    expect(inline.headers.get("content-type")).toContain("image/png");
    expect(inline.headers.get("content-disposition")).toBeNull();
    expectPng(await pngBytes(inline));

    const download = await app.request(`/qr/d/${slug}.png?caption=hello&addLogo=true`);
    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toContain("image/png");
    expect(download.headers.get("content-disposition")).toBe(
      `attachment; filename="${slug}.png"`,
    );
    expectPng(await pngBytes(download));
  });

  it("validates format, caption length, missing links, and deleted links", async () => {
    const slug = uniqueSlug("f7-invalid");
    await insertLink(slug);

    const unsupported = await app.request(`/api/v1/qr/${slug}?format=svg`);
    expect(unsupported.status).toBe(400);
    expect(await unsupported.json()).toEqual({ error: "UNSUPPORTED_FORMAT" });

    const tooLong = await app.request(`/api/v1/qr/${slug}?caption=${"x".repeat(101)}`);
    expect(tooLong.status).toBe(400);
    expect(await tooLong.json()).toEqual({ error: "CAPTION_TOO_LONG" });

    const missing = await app.request(`/api/v1/qr/${uniqueSlug("f7-missing")}`);
    expect(missing.status).toBe(404);

    await db
      .update(schema.linksTable)
      .set({ deletedAt: new Date() })
      .where(eq(schema.linksTable.slug, slug));
    const deleted = await app.request(`/api/v1/qr/${slug}`);
    expect(deleted.status).toBe(404);
  });

  it("lets /qr/:slug fall through to the SPA while preserving .png compat routes", async () => {
    const slug = uniqueSlug("f7-spa");
    await insertLink(slug);

    const page = await app.request(`/qr/${slug}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toBe(SPA_SENTINEL);
  });
});
