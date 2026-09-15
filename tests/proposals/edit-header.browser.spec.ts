/** 编辑页缺少全站导航；复用 Header；锁定登录、退出、回跳及窄屏。 */
import { describe, expect, test } from 'bun:test';
import puppeteer from 'puppeteer-core';
const base = process.env.PROPOSAL_BROWSER_URL;
describe.skipIf(!base)('edit header', () => {
  test('shared header follows session and preserves edit return', async () => {
    if (!base || !['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local fixture required');
    const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(7000);
      // 仅替代 Supabase 登出网络端点；会话订阅与权限 API 使用真实实现。
      await page.setRequestInterception(true);
      page.on('request', req => {
        if (req.url().includes('/auth/v1/logout')) void req.respond({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
        else void req.continue();
      });
      await page.goto(`${base}/edit/handbook`);
      await page.waitForSelector('[data-testid=header-sign-in]');
      expect((await page.$$('[data-testid=site-header]')).length).toBe(1);
      expect(await page.$eval('[data-testid=site-header] a[href="/#features"]', e => e.textContent?.trim())).toBe('特性');
      await page.click('[data-testid=header-sign-in]');
      await page.waitForSelector('input[type=email]');
      await page.goto(`${base}/__test/login/admin`);
      await page.waitForSelector('[data-testid=header-account]');
      expect(await page.$eval('[data-testid=header-account]', e => e.textContent)).toBe('admin@example.test');
      await page.waitForFunction(() => document.querySelector('[data-testid=proposals]')?.textContent?.includes('Approve & apply'));
      for (const width of [1280, 390, 320]) {
        await page.setViewport({ width, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (process.env.PROPOSAL_SCREENSHOTS) await page.screenshot({ path: `${process.env.PROPOSAL_SCREENSHOTS}/header-${width}.png`, fullPage: true });
      }
      await page.click('[data-testid=header-sign-out]');
      await page.waitForSelector('[data-testid=header-sign-in]');
      await page.waitForFunction(() => !document.querySelector('[data-testid=proposals]')?.textContent?.includes('Approve & apply'));
      expect(new URL(page.url()).pathname).toBe('/edit/handbook');
      await page.goto(`${base}/edit/header-new-link`);
      await page.waitForSelector('[data-testid=header-sign-in]');
      expect((await page.$$('[data-testid=site-header]')).length).toBe(1);
    } finally { await browser.close(); }
  }, 60000);
});
