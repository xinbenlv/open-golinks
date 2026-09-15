/** 真实表单点击、匿名提交、owner/admin 审核、焦点恢复与窄屏回归。 */
import { describe, test, expect } from "bun:test";
import puppeteer from "puppeteer-core";
const base = process.env.PROPOSAL_BROWSER_URL;
describe.skipIf(!base)("proposal browser", () => {
  test("anonymous → owner approval → admin rejects stale proposal → member → admin approval", async () => {
    if (!base || !["localhost", "127.0.0.1"].includes(new URL(base).hostname))
      throw new Error("Local test server required");
    const browser = await puppeteer.launch({
      executablePath:
        process.env.CHROME_PATH ??
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: true,
      args: ["--no-sandbox"],
      defaultViewport: { width: 1280, height: 900 },
    });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(10000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      const destination = "#edit-panel-details input[type=url]";
      const submit = ".edit-save-bar button[type=submit]";
      const card = "[data-testid=proposal-card]";
      const screenshots = process.env.PROPOSAL_SCREENSHOTS;
      const capture = async (name: string) => {
        if (screenshots)
          await page.screenshot({
            path: `${screenshots}/${name}.png`,
            fullPage: true,
          });
      };
      await page.goto(`${base}/edit/handbook`);
      await page.waitForSelector(destination);
      await page.waitForSelector(destination);
      await page
        .locator(destination)
        .fill("https://example.test/handbook-2030");
      await capture("proposal-compose");
      await page.locator(submit).click();
      await page.waitForSelector("dialog.proposal-confirmation[open]");
      await page.locator("dialog.proposal-confirmation button[type=submit]").click();
      await page.waitForFunction(() =>
        document.body.textContent?.includes("Proposal submitted"),
      );
      expect(
        await page.$eval(
          "input[type=url]",
          (el) => (el as HTMLInputElement).value,
        ),
      ).toBe("https://example.test/handbook");
      await page.reload();
      await page.waitForSelector("#edit-tab-proposals");
      await page.locator("#edit-tab-proposals").click();
      await page.waitForSelector(card);
      expect(await page.$$(`${card} .text-button`)).toHaveLength(0);
      await page.goto(`${base}/__test/login/owner`);
      await page.waitForSelector(`${card} .text-button`);
      await capture("proposal-review");
      await page.locator(`${card} .text-button`).click();
      await page.waitForSelector("dialog[open]");
      await page.waitForFunction(() =>
        document.querySelector("dialog")?.textContent?.includes("IP address"),
      );
      await capture("submission-details");
      await page.keyboard.press("Escape");
      expect(
        await page.evaluate(() => document.activeElement?.textContent),
      ).toBe("Submission details ↗");
      await page.locator(`${card} .proposal-actions .btn--primary`).click();
      await page.waitForFunction(() =>
        document.body.textContent?.includes("Approved. The link is updated."),
      );
      expect(
        await page.$eval(
          "input[type=url]",
          (el) => (el as HTMLInputElement).value,
        ),
      ).toBe("https://example.test/handbook-2030");
      await page.goto(`${base}/__test/login/admin`);
      await page.waitForSelector(card);
      expect(
        await page.$eval(
          `${card} .btn--primary`,
          (el) => (el as HTMLButtonElement).disabled,
        ),
      ).toBe(true);
      await page.locator(`${card} .proposal-actions .btn--ghost`).click();
      await page.waitForSelector(".reject-form input");
      await page.locator(".reject-form input").fill("Outdated handbook");
      await page.locator(".reject-form .btn--primary").click();
      await page.waitForFunction(() =>
        document.body.textContent?.includes("Proposal rejected."),
      );
      await page.goto(`${base}/__test/login/member`);
      await page.waitForSelector(destination);
      await page.waitForSelector(destination);
      await page
        .locator(destination)
        .fill("https://example.test/handbook-2031");
      await page.locator(submit).click();
      await page.waitForSelector("dialog.proposal-confirmation[open]");
      await page.locator("dialog.proposal-confirmation button[type=submit]").click();
      await page.waitForFunction(() =>
        document.body.textContent?.includes("Proposal submitted"),
      );
      await page.goto(`${base}/__test/login/admin`);
      await page.waitForSelector(`${card} .btn--primary`);
      await page.locator(`${card} .proposal-actions .btn--primary`).click();
      await page.waitForFunction(() =>
        document.body.textContent?.includes("Approved. The link is updated."),
      );
      await page
        .locator("#edit-tab-history")
        .click();
      await page.waitForFunction(() =>
        document.querySelector("#edit-tab-history")?.getAttribute("aria-selected") === "true",
      );
      await page.setViewport({ width: 390, height: 844 });
      await capture("proposal-mobile-history");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      expect(await page.$$(".audit-event")).toHaveLength(3);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  }, 60000);
});
