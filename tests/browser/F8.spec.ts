import { describe, expect, it } from "bun:test";
import { execSync } from "node:child_process";
import { eq } from "drizzle-orm";
import puppeteer from "puppeteer-core";

const BASE_URL =
  process.env.BROWSER_BASE_URL ||
  "https://open-golinks-v2-hono-production.up.railway.app";
const runBrowser = Boolean(process.env.BROWSER_BASE_URL) ||
  process.env.RUN_BROWSER_TESTS === "1";
const browserIt = runBrowser && Boolean(process.env.DATABASE_URL) ? it : it.skip;

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
  return `f8-ui-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
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

async function insertLink(slug: string) {
  const { db, schema } = await import("../../src/db/db.ts");
  await cleanupSlug(slug);
  await db.insert(schema.linksTable).values({
    slug,
    url: `https://example.com/f8/${slug}`,
    urlHistory: [],
  });
}

describe("F8 detailed stats browser smoke", () => {
  browserIt("renders public stats controls and slug detail from the expected build", async () => {
    const slug = uniqueSlug();
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    const errors: string[] = [];
    const serverErrors: string[] = [];
    const statsStatuses: number[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("response", (res) => {
      if (res.url().includes("/api/v1/stats/query")) {
        statsStatuses.push(res.status());
      }
      if (res.status() >= 500 && res.url().startsWith(BASE_URL)) {
        serverErrors.push(`${res.status()} ${res.url()}`);
      }
    });

    try {
      await insertLink(slug);
      await page.goto(`${BASE_URL}/stats`, { waitUntil: "networkidle0" });
      await page.waitForFunction(
        () =>
          window.location.pathname === "/stats" &&
          document.body.innerText.includes("Public stats") &&
          document.body.innerText.includes("Group by path"),
        { timeout: 20_000 },
      );

      const version = await page.evaluate(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/v1/version`);
        if (!res.ok) throw new Error(`version request failed: ${res.status}`);
        return (await res.json()) as { sha?: string };
      }, BASE_URL);
      expect(version.sha).toBe(expectedSha());
      expect(statsStatuses.every((status) => status === 200)).toBe(true);

      await page.evaluate(async (createdSlug) => {
        await fetch(`/${createdSlug}?utm_source=f8`, { redirect: "manual" });
      }, slug);

      await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll("button")).find(
          (node) => node.textContent?.trim() === "30d",
        ) as HTMLButtonElement | undefined;
        button?.click();
      });
      await page.type("#stats-path-regex", `^/${slug}`);
      await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll("button")).find(
          (node) => node.textContent?.trim() === "Apply",
        ) as HTMLButtonElement | undefined;
        button?.click();
      });
      await page.click(".stats-query-toggle input");
      await page.waitForFunction(
        () => document.body.innerText.includes("Include query string"),
        { timeout: 15_000 },
      );

      await page.goto(`${BASE_URL}/stats/${slug}`, { waitUntil: "networkidle0" });
      await page.waitForFunction(
        (createdSlug) => document.body.innerText.includes(`Stats for /${createdSlug}`),
        { timeout: 20_000 },
        slug,
      );
      expect(statsStatuses.every((status) => status === 200)).toBe(true);
      expect(errors).toEqual([]);
      expect(serverErrors).toEqual([]);
    } finally {
      await browser.close();
      await cleanupSlug(slug).catch(() => null);
    }
  }, 60_000);
});
