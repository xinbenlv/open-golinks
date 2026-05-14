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

function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

async function generateMagicLink(label: string) {
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
      email: `f14-${label}-${Date.now()}@example.com`,
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

describe("F14 metadata browser smoke", () => {
  browserIt("edits metadata and filters dashboard links by tag", async () => {
    const workSlug = uniqueSlug("f14-work");
    const personalSlug = uniqueSlug("f14-personal");
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
      await cleanupSlug(workSlug);
      await cleanupSlug(personalSlug);
      await page.goto(await generateMagicLink("owner"), { waitUntil: "networkidle0" });
      await page.waitForFunction(() => window.location.pathname === "/dashboard", {
        timeout: 15_000,
      });

      const version = await page.evaluate(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/v1/version`);
        if (!res.ok) throw new Error(`version request failed: ${res.status}`);
        return (await res.json()) as { sha?: string };
      }, BASE_URL);
      expect(version.sha).toBe(expectedSha());

      await page.evaluate(
        async (firstSlug, secondSlug) => {
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
          if (!token) throw new Error("access token not found");

          for (const [slug, tags] of [
            [firstSlug, ["work"]],
            [secondSlug, ["personal"]],
          ] as const) {
            const res = await fetch("/api/v1/links", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                slug,
                url: `https://example.com/f14/${slug}`,
                metadata: { tags },
              }),
            });
            if (res.status !== 201) throw new Error(`create failed: ${res.status}`);
          }
        },
        workSlug,
        personalSlug,
      );

      await page.goto(`${BASE_URL}/edit/${workSlug}`, { waitUntil: "networkidle0" });
      await page.waitForSelector("textarea", { timeout: 15_000 });
      await page.type("textarea", "TPS report");
      await page.type('input[placeholder="Add tag"]', "urgent");
      await page.keyboard.press("Enter");
      await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll("button")).find(
          (node) => node.textContent?.trim() === "保存",
        ) as HTMLButtonElement | undefined;
        button?.click();
      });
      await page.waitForFunction(
        () => document.body.innerText.includes("已保存。"),
        { timeout: 15_000 },
      );

      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle0" });
      await page.waitForFunction(
        (slug) => document.body.innerText.includes(slug),
        { timeout: 15_000 },
        workSlug,
      );
      await page.select('select[aria-label="Filter by tag"]', "work");
      await page.waitForFunction(
        (firstSlug, secondSlug) => {
          const text = document.body.innerText;
          return text.includes(firstSlug) && !text.includes(secondSlug);
        },
        { timeout: 15_000 },
        workSlug,
        personalSlug,
      );
      const bodyText = await page.evaluate(() => document.body.innerText);
      expect(bodyText).toContain("TPS report");
      expect(bodyText).toContain("urgent");

      expect(serverErrors).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
      await cleanupSlug(workSlug);
      await cleanupSlug(personalSlug);
    }
  }, 60_000);
});
