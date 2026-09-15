/** 已有主人原来无头像；Jazzicon 修复；锁定访客可见、认领即显示及保存后稳定。 */
import { describe, expect, test } from "bun:test";
import puppeteer from "puppeteer-core";
const base = process.env.PROPOSAL_BROWSER_URL;
describe.skipIf(!base)("owner avatar browser", () => {
  test("owner Jazzicon stays stable across viewers, claims and saves", async () => {
    if (!base || !["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("Local fixture required");
    const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(10000);
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(String(error)));
      const avatar = "[data-testid=owner-avatar]";
      const rendered = `${avatar} svg rect`;
      const image = async () => page.$eval(`${avatar} .owner-avatar__image`, el => el.innerHTML);
      const capture = async (name: string) => {
        if (process.env.PROPOSAL_SCREENSHOTS) await page.screenshot({ path: `${process.env.PROPOSAL_SCREENSHOTS}/${name}.png`, fullPage: true });
      };
      await page.goto(`${base}/edit/handbook`);
      await page.waitForSelector(rendered);
      const ownerImage = await image();
      expect(await page.$("[data-testid=claim-ownership]")).toBeNull();
      expect(await page.$(`${avatar} img`)).toBeNull();
      for (const width of [1280, 390, 320]) {
        await page.setViewport({ width, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.focus("[data-testid=copy-slug]");
        await page.focus(`${avatar} button`);
        await page.waitForSelector(`${avatar} [role=tooltip]`, { visible: true });
        expect(await page.$eval(`${avatar} button`, el => el.getBoundingClientRect().height)).toBe(44);
        await capture(`owner-after-${width}`);
        await page.keyboard.press("Escape");
        await page.waitForSelector(`${avatar} [role=tooltip]`, { hidden: true });
      }
      await page.goto(`${base}/__test/login/member?next=/edit/handbook`);
      await page.waitForSelector(rendered);
      expect(await image()).toBe(ownerImage);
      await page.goto(`${base}/__test/login/anonymous`);
      await page.waitForSelector(rendered);
      await page.goto(`${base}/edit/avatar-unowned`);
      await page.waitForSelector("[data-testid=claim-ownership] a");
      expect(await page.$(avatar)).toBeNull();
      await page.goto(`${base}/__test/login/claimant?next=/edit/avatar-unowned`);
      await page.waitForSelector("[data-testid=claim-ownership] button");
      const url = "#edit-panel-details input[type=url]";
      await page.locator(url).fill("https://example.test/avatar-draft");
      await page.locator("[data-testid=claim-ownership] button").click();
      await page.waitForSelector(rendered);
      const claimedImage = await image();
      expect(claimedImage).not.toBe(ownerImage);
      expect(await page.$eval(url, el => (el as HTMLInputElement).value)).toBe("https://example.test/avatar-draft");
      expect(await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))).toBe("copy-slug");
      await page.locator(".edit-save-bar button[type=submit]").click();
      await page.waitForFunction(() => document.querySelector('.edit-save-bar button[type=submit]') === null);
      expect(await image()).toBe(claimedImage);
      await page.reload();
      await page.waitForSelector(rendered);
      expect(await image()).toBe(claimedImage);
      expect(errors).toEqual([]);
    } finally { await browser.close(); }
  }, 60000);
});
