import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import puppeteer from "puppeteer-core";
import type { Page } from "puppeteer-core";

const BASE_URL =
  process.env.BROWSER_BASE_URL ||
  "https://open-golinks-v2-hono-production.up.railway.app";
const shouldCapture = process.env.CAPTURE_README_TOUR === "1";
const runBrowser =
  Boolean(process.env.BROWSER_BASE_URL) || process.env.RUN_BROWSER_TESTS === "1";
const browserIt = shouldCapture && runBrowser && Boolean(process.env.DATABASE_URL)
  ? it
  : it.skip;

const CHROME_PATH =
  process.env.CHROME_PATH ||
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "/usr/bin/google-chrome");

const assetsDir = fileURLToPath(new URL("../../docs/assets/", import.meta.url));
const framesDir = fileURLToPath(
  new URL("../../docs/assets/.readme-tour-frames/", import.meta.url),
);
const gifPath = fileURLToPath(new URL("../../docs/assets/readme-tour.gif", import.meta.url));

function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
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

async function setTourMetadata(slug: string) {
  const { db, schema } = await import("../../src/db/db.ts");
  await db
    .update(schema.linksTable)
    .set({
      metadata: {
        description: "README product tour",
        tags: ["docs", "demo"],
        show_warning: true,
        caption: "Open GoLinks",
        addLogo: true,
      },
      updatedAt: new Date(),
    })
    .where(eq(schema.linksTable.slug, slug));
}

async function screenshot(page: Page, frameName: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((resolve) => setTimeout(resolve, 700));
  await page.screenshot({
    path: `${framesDir}/${frameName}.png`,
    type: "png",
    fullPage: false,
  });
}

function buildGif() {
  if (!existsSync("/opt/homebrew/bin/ffmpeg") && !existsSync("/usr/bin/ffmpeg")) {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  }
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-framerate",
      "0.5",
      "-pattern_type",
      "glob",
      "-i",
      `${framesDir}/frame-*.png`,
      "-vf",
      "scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5",
      "-loop",
      "0",
      gifPath,
    ],
    { stdio: "inherit" },
  );
}

describe("README product tour capture", () => {
  browserIt("captures the high-level README GIF from browser e2e flows", async () => {
    const mainSlug = uniqueSlug("readme-tour");
    mkdirSync(assetsDir, { recursive: true });
    rmSync(framesDir, { recursive: true, force: true });
    mkdirSync(framesDir, { recursive: true });

    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
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
      await cleanupSlug(mainSlug);

      await page.goto(BASE_URL, { waitUntil: "networkidle0" });
      await page.type('input[type="url"]', "https://github.com/xinbenlv/open-golinks");
      await page.type('input[type="text"]', mainSlug);
      await screenshot(page, "frame-01-landing");

      await page.click('button[type="submit"]');
      await page.waitForFunction(
        (slug) =>
          document.body.innerText.includes("短链已生成") &&
          document.body.innerText.includes(slug) &&
          document.querySelector("canvas"),
        { timeout: 15_000 },
        mainSlug,
      );
      await screenshot(page, "frame-02-created-qr");

      await setTourMetadata(mainSlug);
      await page.evaluate(async (slug) => {
        await fetch(`/${slug}?confirm=1`, { redirect: "manual" });
      }, mainSlug);

      await page.goto(`${BASE_URL}/edit/${mainSlug}`, { waitUntil: "networkidle0" });
      await page.waitForFunction(
        (slug) =>
          document.body.innerText.includes(`QR for /${slug}`) &&
          document.querySelector("canvas"),
        { timeout: 15_000 },
        mainSlug,
      );
      await screenshot(page, "frame-03-edit-qr");

      await page.goto(`${BASE_URL}/stats`, { waitUntil: "networkidle0" });
      await page.waitForFunction(
        () =>
          document.body.innerText.includes("Public stats") &&
          document.body.innerText.includes("Group by path"),
        { timeout: 20_000 },
      );
      await screenshot(page, "frame-04-stats");

      await page.goto(`${BASE_URL}/warn/${mainSlug}`, { waitUntil: "networkidle0" });
      await page.waitForFunction(
        () => document.body.innerText.includes("Proceed"),
        { timeout: 15_000 },
      );
      await screenshot(page, "frame-05-warning");

      buildGif();
      expect(existsSync(gifPath)).toBe(true);
      expect(errors).toEqual([]);
      expect(serverErrors).toEqual([]);
    } finally {
      await browser.close();
      await cleanupSlug(mainSlug).catch(() => null);
      rmSync(framesDir, { recursive: true, force: true });
    }
  }, 90_000);
});
