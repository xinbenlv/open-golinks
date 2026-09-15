/** 用户要求无主也显示空缺头像；点击才展开认领，锁定键盘、关闭与窄屏行为。 */
import { describe, expect, test } from "bun:test";
import puppeteer from "puppeteer-core";
const base = process.env.PROPOSAL_BROWSER_URL;
describe.skipIf(!base)("unowned avatar browser", () => {
  test("empty avatar reveals ZGID claim only after activation", async () => {
    if (!base || !["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("Local fixture required");
    const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage();
      const trigger = '[data-testid=unowned-avatar] summary';
      const login = '[data-testid=claim-ownership] a';
      await page.goto(`${base}/edit/avatar-empty`);
      await page.waitForSelector(trigger, { timeout: 5000 });
      for (const width of [1280, 390, 320]) {
        await page.setViewport({ width, height: 844 });
        await page.waitForSelector(login, { hidden: true });
        expect(await page.$eval(trigger, el => el.getBoundingClientRect().height)).toBe(44);
        expect(await page.$('[data-testid=owner-avatar]')).toBeNull();
        await page.focus(trigger);
        await page.keyboard.press('Enter');
        await page.waitForSelector(login, { visible: true });
        expect(await page.$eval(login, el => el.textContent)).toBe('Login with your ZGID to claim and edit');
        expect(await page.$eval(login, el => el.getAttribute('href'))).toBe('/login?claim=1&next=%2Fedit%2Favatar-empty');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('A');
        await page.keyboard.press('Escape');
        await page.waitForSelector(login, { hidden: true });
        expect(await page.$eval(trigger, el => el === document.activeElement)).toBe(true);
        if (process.env.PROPOSAL_SCREENSHOTS) await page.screenshot({ path: `${process.env.PROPOSAL_SCREENSHOTS}/unowned-avatar-${width}.png` });
        await page.keyboard.press('Space');
        await page.waitForSelector(login, { visible: true });
        if (process.env.PROPOSAL_SCREENSHOTS) await page.screenshot({ path: `${process.env.PROPOSAL_SCREENSHOTS}/unowned-avatar-open-${width}.png` });
        await page.locator('#edit-panel-details input[type=url]').click();
        await page.waitForSelector(login, { hidden: true });
      }
      await page.locator(trigger).click();
      await page.locator(login).click();
      await page.waitForSelector('#login-email');
      expect(new URL(page.url()).searchParams.get('next')).toBe('/edit/avatar-empty');
    } finally { await browser.close(); }
  }, 60000);
});
