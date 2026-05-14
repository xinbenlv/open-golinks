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
  return `f12-ui-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

async function generateAccessToken(label: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secret) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");
  }
  const email = `f12-${label}-${Date.now()}@example.com`;
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
      redirect_to: `${BASE_URL.replace(/\/$/, "")}/auth/callback`,
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
  if (!verified.access_token) {
    throw new Error(`verify failed: ${verify.status}`);
  }
  return verified.access_token;
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

describe("F12 public browse drop browser smoke", () => {
  browserIt("keeps the public browse surface closed in production", async () => {
    const slug = uniqueSlug();
    const token = await generateAccessToken("owner");
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    const errors: string[] = [];
    const serverErrors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (
        msg.type() === "error" &&
        !/^Failed to load resource: the server responded with a status of (400|401)/.test(text)
      ) {
        errors.push(text);
      }
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

      const pageText = await page.evaluate(() => document.body.innerText);
      expect(pageText).not.toContain("公开可见");

      const unauthenticatedList = await page.evaluate(async () => {
        const res = await fetch("/api/v1/links");
        return { status: res.status, body: await res.json() };
      });
      expect(unauthenticatedList).toEqual({
        status: 401,
        body: { error: "UNAUTHORIZED" },
      });

      const created = await page.evaluate(
        async (createdSlug, accessToken) => {
          const res = await fetch("/api/v1/links", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              slug: createdSlug,
              url: `https://example.com/f12/${createdSlug}`,
            }),
          });
          return { status: res.status, body: await res.json() };
        },
        slug,
        token,
      );
      expect(created.status).toBe(201);
      expect(created.body.link.isPublic).toBe(false);

      const ownerList = await page.evaluate(
        async (createdSlug, accessToken) => {
          const res = await fetch(`/api/v1/links?q=${encodeURIComponent(createdSlug)}`, {
            headers: { authorization: `Bearer ${accessToken}` },
          });
          return { status: res.status, body: await res.json() };
        },
        slug,
        token,
      );
      expect(ownerList.status).toBe(200);
      expect(ownerList.body.links.map((link: { slug: string }) => link.slug)).toContain(slug);

      const publicList = await page.evaluate(async (accessToken) => {
        const res = await fetch("/api/v1/links?owner=public", {
          headers: { authorization: `Bearer ${accessToken}` },
        });
        return { status: res.status, body: await res.json() };
      }, token);
      expect(publicList.status).toBe(400);
      expect(publicList.body.error).toBe("INVALID_INPUT");

      expect(serverErrors).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
      await cleanupSlug(slug);
    }
  }, 45_000);
});
