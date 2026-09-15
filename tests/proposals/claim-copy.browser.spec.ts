/** 无主链接登录回跳、认领即保存，以及 slug/icon 复制、键盘与手机布局回归。 */
import { describe, test, expect } from "bun:test";
import puppeteer, { type Page } from "puppeteer-core";
const base = process.env.PROPOSAL_BROWSER_URL;
describe.skipIf(!base)("claim and copy browser", () => {
  test("login returns to link; claim preserves draft and immediately enables Save", async () => {
    if (!base || !["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("Local fixture required");
    const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"], defaultViewport: {width:1280,height:900} });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(10000);
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(String(error)));
      await browser.defaultBrowserContext().overridePermissions(base, ["clipboard-read", "clipboard-sanitized-write"]);
      const capture = async (name: string) => {
        if (process.env.PROPOSAL_SCREENSHOTS) await page.screenshot({ path: `${process.env.PROPOSAL_SCREENSHOTS}/${name}.png`, fullPage: true });
      };
      const field = "#edit-panel-details input[type=url]";
      const claimButton = "[data-testid=claim-ownership] button";
      const login = "[data-testid=claim-ownership] a";
      const openClaim = async (target: Page) => {
        const selector = "[data-testid=unowned-avatar]";
        if (!await target.$eval(selector, el => (el as HTMLDetailsElement).open)) await target.locator(selector + " summary").click();
      };
      await page.goto(`${base}/edit/unowned`);
      await page.waitForSelector(login);
      expect(await page.$eval(login, el => el.textContent)).toBe("Login with your ZGID to claim and edit");
      expect(await page.$eval('[data-testid=copy-short-link]', el => el.textContent?.trim())).toBe("");
      for (const width of [1280, 390, 320]) {
        await page.setViewport({width,height:900});
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        for (const selector of ["[data-testid=copy-slug]", "[data-testid=copy-short-link]"]) {
          const box = await page.$eval(selector, el => { const r = el.getBoundingClientRect(); return {height:r.height,width:r.width}; });
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
          await page.locator(selector).click();
          await page.waitForFunction(() => document.querySelector('[role=status]')?.textContent === "Copied");
          expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${base}/unowned`);
          await page.focus(selector);
          await page.keyboard.press(selector.includes("copy-slug") ? "Enter" : "Space");
          expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${base}/unowned`);
        }
        await capture(`after-${width}`);
      }
      await browser.defaultBrowserContext().overridePermissions(base, ["clipboard-read"]);
      await page.locator("[data-testid=copy-short-link]").click();
      await page.waitForFunction(() => document.querySelector('.edit-copy-feedback')?.textContent?.includes("Could not copy"));
      await browser.defaultBrowserContext().overridePermissions(base, ["clipboard-read", "clipboard-sanitized-write"]);
      await page.locator("[data-testid=copy-short-link]").click();
      await page.waitForFunction(() => document.querySelector('.edit-copy-feedback')?.textContent === "Copied");
      // 保留独立 Go 导航，提议确认只在提交时出现，取消保留草稿。
      expect(await page.$eval(".edit-go-button", el => el.getAttribute("href"))).toBe("/unowned");
      await page.locator(field).fill("https://example.test/draft");
      expect(await page.$("dialog[open]")).toBeNull();
      await page.locator(".edit-save-bar button[type=submit]").click();
      await page.waitForSelector("dialog[open]");
      await page.waitForFunction(() => document.querySelector("dialog")?.textContent?.includes("127.0.0.1"));
      await page.locator("dialog button[type=button].btn--ghost").click();
      expect(await page.$eval(field, el => (el as HTMLInputElement).value)).toBe("https://example.test/draft");
      await openClaim(page);
      await page.locator(login).click();
      await page.waitForSelector("#login-email");
      expect(new URL(page.url()).searchParams.get("next")).toBe("/edit/unowned");
      await page.locator("#login-email").fill("member@zg.io");
      await page.locator(".auth-submit").click();
      await page.waitForFunction(() => document.body.textContent?.includes("请使用 @zgzg.io"));
      // 只替换外部邮件服务；会话由本地 JWKS 签名，认领和保存均走真实 API/DB。
      const session = await fetch(`${base}/__test/session/claimant`).then(r => r.json());
      let redirect = "";
      await page.setRequestInterception(true);
      const authMock = (target: Page) => target.on("request", async req => {
        if (!req.url().startsWith("http://127.0.0.1:55448/")) { await req.continue(); return; }
        const headers = {"access-control-allow-origin":base!,"access-control-allow-headers":"*","content-type":"application/json"};
        if (req.method() === "OPTIONS") { await req.respond({status:204,headers}); return; }
        if (req.url().includes("/otp")) { redirect = new URL(req.url()).searchParams.get("redirect_to") ?? ""; await req.respond({status:200,headers,body:"{}"}); return; }
        await req.respond({status:200,headers,body:JSON.stringify(req.url().includes("/user") ? session.user : session)});
      });
      authMock(page);
      await page.locator("#login-email").fill("claimant@zgzg.io");
      await page.locator(".auth-submit").click();
      await page.waitForFunction(() => document.body.textContent?.includes("登录链接已发送"));
      expect(new URL(redirect).searchParams.get("next")).toBe("/edit/unowned");
      // 旧 /auth/confirm 模板不带 next：在新 tab 完成 callback 也应从存储恢复目标。
      const callback = await browser.newPage();
      await callback.setRequestInterception(true); authMock(callback);
      await callback.goto(`${base}/auth/callback?code=local-test-code`);
      await callback.waitForSelector(claimButton);
      expect(new URL(callback.url()).pathname).toBe("/edit/unowned");
      await callback.locator(field).fill("https://example.test/claimed-draft");
      await openClaim(callback);
      await callback.locator(claimButton).click();
      await callback.waitForFunction(() => document.body.textContent?.includes("Ownership claimed."));
      expect(await callback.evaluate(() => document.activeElement?.getAttribute("data-testid"))).toBe("copy-slug");
      expect(await callback.$eval(field, el => (el as HTMLInputElement).value)).toBe("https://example.test/claimed-draft");
      expect(await callback.$eval(".edit-save-bar button[type=submit]", el => el.textContent)).toBe("Save");
      await callback.locator(".edit-save-bar button[type=submit]").click();
      await callback.waitForFunction(() => !document.querySelector(".edit-save-bar button[type=submit]"));
      expect((await fetch(`${base}/api/v1/links/unowned`).then(r => r.json())).link.url).toBe("https://example.test/claimed-draft");
      await callback.close();
      await page.goto(`${base}/edit/this-is-a-long-short-link-slug-for-mobile-layout`);
      await page.waitForSelector(claimButton);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await capture("long-slug-320");
      // 页面载入后另一账号抢先认领：原按钮给出清楚冲突，不显示成功。
      await page.goto(`${base}/edit/claim-race`);
      await page.waitForSelector(claimButton);
      const competitor = await fetch(`${base}/__test/session/competitor`).then(r => r.json());
      expect((await fetch(`${base}/api/v1/links/claim-race/claim`, {method:"POST",headers:{Authorization:`Bearer ${competitor.access_token}`}})).status).toBe(200);
      await openClaim(page);
      await page.locator(claimButton).click();
      await page.waitForFunction(() => document.querySelector('[data-testid=claim-ownership] [role=alert]')?.textContent?.includes("already been claimed"));
      await page.goto(`${base}/__test/login/member`);
      await page.goto(`${base}/edit/claim-race`);
      await page.waitForSelector(field);
      expect(await page.$("[data-testid=claim-ownership]")).toBeNull();
      await page.goto(`${base}/edit/this-is-a-long-short-link-slug-for-mobile-layout`);
      await page.waitForSelector(claimButton);
      expect(await page.$eval(claimButton, el => el.textContent)).toBe("Login with your ZGID to claim and edit");
      await openClaim(page);
      await page.locator(claimButton).click();
      await page.waitForSelector("#login-email");
      expect(new URL(page.url()).searchParams.get("claim")).toBe("1");
      expect(errors).toEqual([]);
    } finally { await browser.close(); }
  }, 90000);
});
