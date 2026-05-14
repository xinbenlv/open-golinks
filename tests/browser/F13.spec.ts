import { describe, expect, it } from "bun:test";
import { execSync } from "node:child_process";
import { eq } from "drizzle-orm";
import puppeteer from "puppeteer-core";

const BASE_URL =
  process.env.BROWSER_BASE_URL ||
  "https://open-golinks-v2-hono-production.up.railway.app";
const runBrowser = Boolean(process.env.BROWSER_BASE_URL) ||
  process.env.RUN_BROWSER_TESTS === "1";
const browserIt = runBrowser ? it : it.skip;

const CHROME_PATH =
  process.env.CHROME_PATH ||
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "/usr/bin/google-chrome");

function expectedSha(): string {
  if (process.env.EXPECTED_SHA) return process.env.EXPECTED_SHA.slice(0, 6);
  return execSync("git rev-parse --short=6 HEAD").toString().trim();
}

function uniqueSlug() {
  return `f13-ui-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

async function cleanupSlug(slug: string) {
  if (!process.env.DATABASE_URL) return;
  const { db, schema } = await import("../../src/db/db.ts");
  await db
    .delete(schema.auditLogsTable)
    .where(eq(schema.auditLogsTable.linkSlug, slug));
  await db
    .delete(schema.dailyVisitsTable)
    .where(eq(schema.dailyVisitsTable.linkSlug, slug));
  await db.delete(schema.linksTable).where(eq(schema.linksTable.slug, slug));
}

describe("F13 Chrome extension compatibility browser smoke", () => {
  browserIt("exercises the legacy /api/v2 extension endpoints in production", async () => {
    const slug = uniqueSlug();
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    const errors: string[] = [];
    const serverErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("response", (res) => {
      if (res.status() >= 500 && res.url().startsWith(BASE_URL)) {
        serverErrors.push(`${res.status()} ${res.url()}`);
      }
    });

    try {
      await cleanupSlug(slug);
      await page.goto(BASE_URL, { waitUntil: "networkidle0" });

      const version = await page.evaluate(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/v1/version`);
        if (!res.ok) throw new Error(`version request failed: ${res.status}`);
        return (await res.json()) as { sha?: string };
      }, BASE_URL);
      expect(version.sha).toBe(expectedSha());

      const before = await page.evaluate(async (createdSlug) => {
        const res = await fetch(`/api/v2/available/${createdSlug}`);
        return { status: res.status, body: await res.json() };
      }, slug);
      expect(before).toEqual({ status: 200, body: true });

      const created = await page.evaluate(async (createdSlug) => {
        const res = await fetch("/api/v2/edit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            golink: createdSlug,
            dest: `https://example.com/f13/${createdSlug}`,
            addLogo: true,
            caption: "Compat",
          }),
        });
        return { status: res.status, body: await res.json() };
      }, slug);
      expect(created.status).toBe(200);
      expect(created.body).toMatchObject({
        golink: slug,
        author: "anonymous",
        addLogo: true,
        caption: "Compat",
        editable: false,
      });

      const lookup = await page.evaluate(async (createdSlug) => {
        const res = await fetch(`/api/v2/link/${createdSlug}`);
        return { status: res.status, body: await res.json() };
      }, slug);
      expect(lookup.status).toBe(200);
      expect(lookup.body[0]).toMatchObject({
        goLink: slug,
        goDest: `https://example.com/f13/${slug}`,
        author: "anonymous",
        addLogo: true,
        caption: "Compat",
      });

      const after = await page.evaluate(async (createdSlug) => {
        const res = await fetch(`/api/v2/available/${createdSlug}`);
        return { status: res.status, body: await res.json() };
      }, slug);
      expect(after).toEqual({ status: 200, body: false });

      expect(serverErrors).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
      await cleanupSlug(slug);
    }
  }, 45_000);
});
