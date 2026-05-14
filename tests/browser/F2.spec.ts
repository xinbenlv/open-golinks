import { describe, expect, it } from "bun:test";
import { execSync } from "node:child_process";
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
  return `f2-ui-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
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
      email: `f2-browser-${Date.now()}@example.com`,
      redirect_to: `${BASE_URL.replace(/\/$/, "")}/auth/callback`,
    }),
  });
  const data = (await res.json()) as { action_link?: string };
  if (!res.ok || !data.action_link) {
    throw new Error(`generate_link failed: ${res.status}`);
  }
  return data.action_link;
}

describe("F2 CRUD browser smoke", () => {
  browserIt("logs in, creates an owned link, edits it, deletes it, and sees 404", async () => {
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
      if (msg.type() === "error") {
        const text = msg.text();
        if (
          text.includes("Failed to load resource") &&
          text.includes("404")
        ) {
          return;
        }
        errors.push(text);
      }
    });
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("response", (res) => {
      if (res.status() >= 500 && res.url().startsWith(BASE_URL)) {
        serverErrors.push(`${res.status()} ${res.url()}`);
      }
    });
    page.on("dialog", (dialog) => void dialog.accept());

    try {
      const actionLink = await generateMagicLink();
      await page.goto(actionLink, { waitUntil: "networkidle0" });
      await page.waitForFunction(() => window.location.pathname === "/dashboard", {
        timeout: 15_000,
      });

      const version = await page.evaluate(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/v1/version`);
        if (!res.ok) throw new Error(`version request failed: ${res.status}`);
        return (await res.json()) as { sha?: string };
      }, BASE_URL);
      expect(version.sha).toBe(expectedSha());

      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle0" });
      await page.type('input[type="url"]', "https://example.com/f2-created");
      await page.type('input[type="text"]', slug);
      await page.click('button[type="submit"]');
      await page.waitForFunction(
        () => document.body.innerText.includes("短链已生成"),
        { timeout: 15_000 },
      );

      const ownerId = await page.evaluate(async (createdSlug) => {
        const res = await fetch(`/api/v1/links/${createdSlug}`);
        const body = (await res.json()) as { link?: { ownerId?: string | null } };
        return body.link?.ownerId ?? null;
      }, slug);
      expect(ownerId).toBeTruthy();

      await page.goto(`${BASE_URL}/edit/${slug}`, { waitUntil: "networkidle0" });
      await page.waitForFunction(
        (createdSlug) => document.body.innerText.includes(`编辑 /${createdSlug}`),
        { timeout: 15_000 },
        slug,
      );
      await page.click('input[type="url"]', { clickCount: 3 });
      await page.type('input[type="url"]', "https://example.com/f2-edited");
      await page.click('button[type="submit"]');
      await page.waitForFunction(
        () => document.body.innerText.includes("已保存。"),
        { timeout: 15_000 },
      );

      await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll("button")).find((el) =>
          el.textContent?.includes("删除"),
        );
        if (!(button instanceof HTMLButtonElement)) {
          throw new Error("delete button not found");
        }
        button.click();
      });
      await page.waitForFunction(
        () => document.body.innerText.includes("创建短链"),
        { timeout: 15_000 },
      );

      const deleted = await page.evaluate(async (createdSlug) => {
        const res = await fetch(`/${createdSlug}`, { redirect: "manual" });
        return { status: res.status, location: res.headers.get("location") };
      }, slug);
      expect(deleted).toEqual({ status: 404, location: null });
      expect(errors).toEqual([]);
      expect(serverErrors).toEqual([]);
    } finally {
      await browser.close();
    }
  }, 45_000);
});
