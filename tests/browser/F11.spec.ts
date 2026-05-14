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
  return `f11-ui-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function decodePayload(token: string): { sub: string; email?: string } {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("JWT payload missing");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
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
      email: `f11-${label}-${Date.now()}@example.com`,
      redirect_to: `${BASE_URL.replace(/\/$/, "")}/auth/callback`,
    }),
  });
  const data = (await res.json()) as { action_link?: string };
  if (!res.ok || !data.action_link) {
    throw new Error(`generate_link failed: ${res.status}`);
  }
  return data.action_link;
}

async function generateAccessToken(label: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secret) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");
  }
  const email = `f11-${label}-${Date.now()}@example.com`;
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
  return { token: verified.access_token, email: decodePayload(verified.access_token).email! };
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

describe("F11 ownership transfer browser smoke", () => {
  browserIt("transfers a link to another registered user from the edit page", async () => {
    const slug = uniqueSlug();
    const recipient = await generateAccessToken("recipient");
    const ensureRecipient = await fetch(`${BASE_URL}/api/v1/links?owner=me`, {
      headers: { authorization: `Bearer ${recipient.token}` },
    });
    expect(ensureRecipient.status).toBe(200);

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
      await page.goto(await generateMagicLink("sender"), { waitUntil: "networkidle0" });
      await page.waitForFunction(() => window.location.pathname === "/dashboard", {
        timeout: 15_000,
      });

      const version = await page.evaluate(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/v1/version`);
        if (!res.ok) throw new Error(`version request failed: ${res.status}`);
        return (await res.json()) as { sha?: string };
      }, BASE_URL);
      expect(version.sha).toBe(expectedSha());

      await page.evaluate(async (createdSlug) => {
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
        const res = await fetch("/api/v1/links", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            slug: createdSlug,
            url: `https://example.com/f11/${createdSlug}`,
          }),
        });
        if (res.status !== 201) throw new Error(`create failed: ${res.status}`);
      }, slug);

      await page.goto(`${BASE_URL}/edit/${slug}`, { waitUntil: "networkidle0" });
      await page.waitForFunction(
        () => document.body.innerText.includes("Transfer ownership"),
        { timeout: 15_000 },
      );
      await page.type('input[placeholder="teammate@example.com"]', recipient.email);
      page.once("dialog", async (dialog) => {
        expect(dialog.message()).toContain(recipient.email);
        await dialog.accept();
      });
      await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll("button")).find(
          (node) => node.textContent?.trim() === "Transfer",
        ) as HTMLButtonElement | undefined;
        button?.click();
      });
      await page.waitForFunction(
        () => document.body.innerText.includes("Ownership transferred"),
        { timeout: 15_000 },
      );

      const senderLinks = await page.evaluate(async (createdSlug) => {
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
        const res = await fetch(`/api/v1/links?owner=me&q=${createdSlug}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`sender list failed: ${res.status}`);
        return (await res.json()) as { links: Array<{ slug: string }> };
      }, slug);
      expect(senderLinks.links).toEqual([]);

      const recipientLinks = await fetch(
        `${BASE_URL}/api/v1/links?owner=me&q=${encodeURIComponent(slug)}`,
        { headers: { authorization: `Bearer ${recipient.token}` } },
      );
      expect(recipientLinks.status).toBe(200);
      const recipientBody = (await recipientLinks.json()) as {
        links: Array<{ slug: string }>;
      };
      expect(recipientBody.links.map((link) => link.slug)).toContain(slug);

      expect(errors).toEqual([]);
      expect(serverErrors).toEqual([]);
    } finally {
      await browser.close();
      await cleanupSlug(slug).catch(() => null);
    }
  }, 60_000);
});
