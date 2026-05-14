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

function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
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
      email: `f3-browser-${Date.now()}@example.com`,
      redirect_to: `${BASE_URL.replace(/\/$/, "")}/auth/callback`,
    }),
  });
  const data = (await res.json()) as { action_link?: string };
  if (!res.ok || !data.action_link) {
    throw new Error(`generate_link failed: ${res.status}`);
  }
  return data.action_link;
}

describe("F3 dashboard browser smoke", () => {
  browserIt("shows owned links, filters search, and opens edit", async () => {
    const slugA = uniqueSlug("f3-ui-alpha");
    const slugB = uniqueSlug("f3-ui-beta");
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

      await page.evaluate(async ([firstSlug, secondSlug]) => {
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

        for (const [slug, suffix] of [
          [firstSlug, "alpha"],
          [secondSlug, "beta"],
        ] as const) {
          const res = await fetch("/api/v1/links", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              slug,
              url: `https://example.com/f3/${suffix}`,
            }),
          });
          if (res.status !== 201) throw new Error(`create failed: ${res.status}`);
        }
      }, [slugA, slugB]);

      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle0" });
      await page.waitForFunction(
        (slug) => document.body.innerText.includes(`/${slug}`),
        { timeout: 15_000 },
        slugA,
      );
      const allText = await page.evaluate(() => document.body.innerText);
      expect(allText).toContain(`/${slugA}`);
      expect(allText).toContain(`/${slugB}`);

      await page.type('input[type="search"]', slugA);
      await page.waitForFunction(
        ([firstSlug, secondSlug]) => {
          const text = document.body.innerText;
          return text.includes(`/${firstSlug}`) && !text.includes(`/${secondSlug}`);
        },
        { timeout: 15_000 },
        [slugA, slugB],
      );

      await page.click(`a[href="/edit/${slugA}"]`);
      await page.waitForFunction(
        (slug) => window.location.pathname === `/edit/${slug}`,
        { timeout: 15_000 },
        slugA,
      );
      expect(page.url()).toContain(`/edit/${slugA}`);
      expect(errors).toEqual([]);
      expect(serverErrors).toEqual([]);
    } finally {
      await page
        .evaluate(async (slugs) => {
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
          await Promise.all(
            (slugs as string[]).map((slug) =>
              fetch(`/api/v1/links/${slug}`, {
                method: "DELETE",
                headers: { authorization: `Bearer ${token}` },
              }).catch(() => null),
            ),
          );
        }, [slugA, slugB])
        .catch(() => null);
      await browser.close();
    }
  }, 45_000);
});
