import { describe, expect, it } from "bun:test";
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

describe("F1 login browser smoke", () => {
  browserIt("renders login page without console errors", async () => {
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    try {
      await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
      const text = await page.evaluate(() => document.body.innerText);
      expect(text).toContain("登录 Open GoLinks");
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  });
});
