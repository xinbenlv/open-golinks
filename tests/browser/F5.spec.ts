import { describe, expect, it } from "bun:test";
import { execSync } from "node:child_process";
import { eq } from "drizzle-orm";
import puppeteer from "puppeteer-core";

const BASE_URL =
  process.env.BROWSER_BASE_URL ||
  "https://open-golinks-v2-hono-production.up.railway.app";
const runBrowser = Boolean(process.env.BROWSER_BASE_URL) ||
  process.env.RUN_BROWSER_TESTS === "1";
const hasAdminEnv = Boolean(
  process.env.SUPABASE_URL &&
    process.env.SUPABASE_SECRET_KEY &&
    /^[\x20-\x7E]+$/.test(process.env.SUPABASE_SECRET_KEY),
);
const browserIt = runBrowser && hasAdminEnv ? it : it.skip;

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
  return `f5-ui-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

async function generateMagicLink() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secret) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");
  }

  const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: secret,
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      type: "magiclink",
      email: `f5-browser-${Date.now()}@example.com`,
      redirect_to: `${BASE_URL.replace(/\/$/, "")}/auth/callback`,
    }),
  });
  const data = (await res.json()) as { action_link?: string };
  if (!res.ok || !data.action_link) {
    throw new Error(`generate_link failed: ${res.status}`);
  }
  return data.action_link;
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

describe("F5 anonymous claim browser smoke", () => {
  browserIt("creates an anonymous link and claims it after login", async () => {
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
      await page.waitForSelector('input[type="url"]', { timeout: 15_000 });
      await page.type('input[type="url"]', `https://example.com/f5/${slug}`);
      await page.type('input[type="text"]', slug);

      const createResponse = page.waitForResponse(
        (res) =>
          res.url().includes("/api/v1/links") &&
          res.request().method() === "POST",
        { timeout: 15_000 },
      );
      await page.click('button[type="submit"]');
      expect((await createResponse).status()).toBe(201);
      await page.waitForFunction(
        (createdSlug) => document.body.innerText.includes(`/${createdSlug}`),
        { timeout: 15_000 },
        slug,
      );

      const remembered = await page.evaluate((createdSlug) => {
        const rows = JSON.parse(localStorage.getItem("golinks:created") ?? "[]") as
          | Array<{ slug?: string; fingerprint?: string }>
          | unknown;
        return Array.isArray(rows) &&
          rows.some(
            (row) =>
              row.slug === createdSlug &&
              typeof row.fingerprint === "string" &&
              /^[0-9a-f]{64}$/.test(row.fingerprint),
          );
      }, slug);
      expect(remembered).toBe(true);

      await page.goto(`${BASE_URL}/claim/${slug}`, { waitUntil: "networkidle0" });
      await page.waitForFunction(
        (createdSlug) =>
          window.location.pathname === `/claim/${createdSlug}` &&
          document.body.innerText.includes("Login to claim"),
        { timeout: 15_000 },
        slug,
      );

      await page.goto(await generateMagicLink(), { waitUntil: "networkidle0" });
      await page.waitForFunction(() => window.location.pathname === "/dashboard", {
        timeout: 15_000,
      });

      const version = await page.evaluate(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/v1/version`);
        if (!res.ok) throw new Error(`version request failed: ${res.status}`);
        return (await res.json()) as { sha?: string };
      }, BASE_URL);
      expect(version.sha).toBe(expectedSha());

      await page.waitForFunction(
        (createdSlug) => {
          const text = document.body.innerText;
          return text.includes("Unclaimed links") && text.includes(`/${createdSlug}`);
        },
        { timeout: 15_000 },
        slug,
      );
      await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll("button")).find((el) =>
          el.textContent?.includes("Claim all"),
        );
        if (!(button instanceof HTMLButtonElement)) {
          throw new Error("Claim all button not found");
        }
        button.click();
      });
      await page.waitForSelector(`a[href="/edit/${slug}"]`, { timeout: 15_000 });

      expect(errors).toEqual([]);
      expect(serverErrors).toEqual([]);
    } finally {
      await page
        .evaluate(async (createdSlug) => {
          function findToken(value: unknown): string | null {
            if (!value || typeof value !== "object") return null;
            if (
              "access_token" in value &&
              typeof (value as { access_token?: unknown }).access_token === "string"
            ) {
              return (value as { access_token: string }).access_token;
            }
            for (const child of Object.values(value)) {
              const token = findToken(child);
              if (token) return token;
            }
            return null;
          }
          let token: string | null = null;
          for (const key of Object.keys(localStorage)) {
            try {
              token = findToken(JSON.parse(localStorage.getItem(key) ?? "null"));
              if (token) break;
            } catch {
              // Ignore non-JSON localStorage entries.
            }
          }
          if (!token) return;
          await fetch(`/api/v1/links/${createdSlug}`, {
            method: "DELETE",
            headers: { authorization: `Bearer ${token}` },
          }).catch(() => null);
        }, slug)
        .catch(() => null);
      await browser.close();
      await cleanupSlug(slug).catch(() => null);
    }
  }, 60_000);
});
