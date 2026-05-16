import { describe, expect, it } from "bun:test";
import {
  execFileSync,
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import type { HTTPRequest, Page } from "puppeteer-core";

let sourceBaseUrl = process.env.README_SOURCE_BASE_URL ?? "";
const DEMO_ORIGIN = process.env.README_DEMO_ORIGIN || "https://zgzg.li";
const DEMO_SLUG = "team-handbook";
const DEMO_TARGET = "https://zgzg.li/company/handbook";
const shouldCapture = process.env.CAPTURE_README_TOUR === "1";
const browserIt = shouldCapture ? it : it.skip;

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

type DemoLink = {
  slug: string;
  url: string;
  ownerId: string | null;
  isPublic: boolean;
  deletedAt: string | null;
  urlHistory: Array<{ url: string; changedAt: string; changedBy: string }>;
  visits: number;
  createdAt: string;
  updatedAt: string;
  metadata: {
    description: string;
    tags: string[];
    show_warning: boolean;
    caption: string;
    addLogo: boolean;
  };
};

const now = new Date("2026-05-15T17:00:00-07:00").toISOString();
const demoLink: DemoLink = {
  slug: DEMO_SLUG,
  url: DEMO_TARGET,
  ownerId: null,
  isPublic: false,
  deletedAt: null,
  urlHistory: [
    {
      url: "https://zgzg.li/company/old-handbook",
      changedAt: "2026-05-01T09:00:00-07:00",
      changedBy: "demo-owner",
    },
  ],
  visits: 482,
  createdAt: now,
  updatedAt: now,
  metadata: {
    description: "Demo handbook shortcut",
    tags: ["team", "docs"],
    show_warning: true,
    caption: "zgzg.li team handbook",
    addLogo: true,
  },
};

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

function demoWarningHtml() {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Continue to ${DEMO_TARGET}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f7f5f2;
        color: #161616;
      }
      main {
        width: min(560px, calc(100vw - 40px));
        border: 1px solid #ddd8cf;
        border-radius: 8px;
        background: #fff;
        padding: 36px;
        box-shadow: 0 20px 80px rgba(22, 22, 22, 0.12);
      }
      .kicker {
        color: #b42318;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: .04em;
        text-transform: uppercase;
      }
      h1 {
        margin: 10px 0 12px;
        font-size: 34px;
        letter-spacing: 0;
      }
      p {
        color: #5c5a55;
        line-height: 1.6;
      }
      code {
        display: block;
        padding: 14px 16px;
        border-radius: 8px;
        background: #f2f0ec;
        color: #1e1d1a;
        overflow-wrap: anywhere;
      }
      a {
        display: inline-flex;
        margin-top: 22px;
        border-radius: 8px;
        background: #191919;
        color: #fff;
        padding: 12px 18px;
        font-weight: 700;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="kicker">zgzg.li warning page</div>
      <h1>Review before continuing</h1>
      <p>This demo link is configured to show a warning page before redirecting.</p>
      <code>${DEMO_TARGET}</code>
      <a href="/${DEMO_SLUG}?confirm=1">Proceed</a>
    </main>
  </body>
</html>`;
}

function fakeStats(groupBy: string | null) {
  if (groupBy === "date") {
    return {
      rows: [
        { dimension: "20260513", eventCount: 94, activeUsers: 41 },
        { dimension: "20260514", eventCount: 126, activeUsers: 58 },
        { dimension: "20260515", eventCount: 171, activeUsers: 73 },
      ],
      totalEvents: 391,
      source: "ga4",
      scope: { slugCount: 3 },
      dimension: "date",
    };
  }
  return {
    rows: [
      { dimension: `/${DEMO_SLUG}`, eventCount: 248, activeUsers: 109 },
      { dimension: "/roadmap", eventCount: 86, activeUsers: 42 },
      { dimension: "/oncall", eventCount: 57, activeUsers: 28 },
    ],
    totalEvents: 391,
    source: "ga4",
    scope: { slugCount: 3 },
    dimension: "pagePath",
  };
}

function cleanProxyHeaders(headers: Headers) {
  const blocked = new Set([
    "content-encoding",
    "content-length",
    "connection",
    "transfer-encoding",
  ]);
  return Object.fromEntries(
    Array.from(headers.entries()).filter(([name]) => !blocked.has(name.toLowerCase())),
  );
}

async function waitForServer(origin: string, child: ChildProcessWithoutNullStreams) {
  let exited = false;
  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });
  child.once("exit", () => {
    exited = true;
  });

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (exited) throw new Error(`Vite exited before ready:\n${logs}`);
    try {
      const res = await fetch(origin);
      if (res.ok) return;
    } catch {
      // 等待 Vite 监听端口。
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite did not become ready:\n${logs}`);
}

async function startLocalSource() {
  if (sourceBaseUrl) {
    return { stop: async () => undefined };
  }

  const port = Number(process.env.README_TOUR_VITE_PORT ?? 5187);
  const cwd = fileURLToPath(new URL("../../", import.meta.url));
  const env = {
    ...process.env,
    OPEN_GOLINK_THEME: "zgzg",
    VITE_OPEN_GOLINK_THEME: "zgzg",
  };
  sourceBaseUrl = `http://127.0.0.1:${port}`;
  execFileSync("bun", ["run", "build:web"], {
    cwd,
    env,
    stdio: "inherit",
  });
  const child = spawn(
    "./node_modules/.bin/vite",
    [
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd,
      env,
    },
  );
  await waitForServer(sourceBaseUrl, child);

  return {
    stop: async () => {
      child.kill("SIGTERM");
      await new Promise((resolve) => {
        child.once("exit", resolve);
        setTimeout(resolve, 2_000);
      });
    },
  };
}

async function proxyFromSource(request: HTTPRequest) {
  const requestUrl = new URL(request.url());
  const source = new URL(`${requestUrl.pathname}${requestUrl.search}`, sourceBaseUrl);
  const res = await fetch(source, {
    method: request.method(),
    headers: {
      accept: request.headers().accept ?? "*/*",
      "user-agent": request.headers()["user-agent"] ?? "open-golinks-readme-tour",
    },
  });
  const headers = cleanProxyHeaders(res.headers);
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    const body = (await res.text()).replace(
      /<script type="module" src="\/@vite\/client"><\/script>\s*/g,
      "",
    );
    await request.respond({ status: res.status, headers, body });
    return;
  }
  const body = Buffer.from(await res.arrayBuffer());
  await request.respond({ status: res.status, headers, body });
}

async function installDemoMocks(page: Page) {
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    void (async () => {
      const url = new URL(request.url());
      if (url.origin !== DEMO_ORIGIN) {
        await request.continue();
        return;
      }

      if (url.pathname === "/favicon.ico") {
        await request.respond({ status: 204, body: "" });
        return;
      }
      if (url.pathname === "/@vite/client") {
        await request.respond({
          status: 200,
          contentType: "application/javascript",
          body: "",
        });
        return;
      }
      if (url.pathname === "/api/v1/links" && request.method() === "POST") {
        await request.respond(json({ link: demoLink }, 201));
        return;
      }
      if (url.pathname === `/api/v1/links/${DEMO_SLUG}`) {
        await request.respond(json({ link: demoLink }));
        return;
      }
      if (url.pathname === `/api/v1/links/${DEMO_SLUG}/available`) {
        await request.respond(json({ available: false }));
        return;
      }
      if (url.pathname === "/api/v1/stats/query") {
        const body = JSON.parse(request.postData() || "{}") as { groupBy?: string };
        await request.respond(json(fakeStats(body?.groupBy ?? null)));
        return;
      }
      if (url.pathname === "/api/v1/version") {
        await request.respond(json({
          version: "demo",
          sha: "demo00",
          builtAt: now,
          branch: "readme-demo",
        }));
        return;
      }
      if (url.pathname === `/${DEMO_SLUG}` && url.searchParams.get("confirm") === "1") {
        await request.respond({
          status: 302,
          headers: { location: DEMO_TARGET },
          body: "",
        });
        return;
      }
      if (url.pathname === `/warn/${DEMO_SLUG}`) {
        await request.respond({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: demoWarningHtml(),
        });
        return;
      }

      await proxyFromSource(request);
    })().catch(async () => {
      await request.respond({ status: 500, body: "README demo proxy failed" });
    });
  });
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
  browserIt("captures a fake-data README GIF from browser e2e flows", async () => {
    mkdirSync(assetsDir, { recursive: true });
    rmSync(framesDir, { recursive: true, force: true });
    mkdirSync(framesDir, { recursive: true });

    const source = await startLocalSource();
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await installDemoMocks(page);
    const errors: string[] = [];
    const serverErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("response", (res) => {
      if (res.status() >= 500 && res.url().startsWith(DEMO_ORIGIN)) {
        serverErrors.push(`${res.status()} ${res.url()}`);
      }
    });

    try {
      await page.goto(DEMO_ORIGIN, { waitUntil: "networkidle0" });
      await page.type('input[type="url"]', DEMO_TARGET);
      await page.type('input[type="text"]', DEMO_SLUG);
      await screenshot(page, "frame-01-landing");

      await page.click('button[type="submit"]');
      await page.waitForFunction(
        (slug) =>
          document.body.innerText.includes("短链已生成") &&
          document.body.innerText.includes(slug) &&
          document.querySelector("canvas"),
        { timeout: 15_000 },
        DEMO_SLUG,
      );
      await screenshot(page, "frame-02-created-qr");

      await page.goto(`${DEMO_ORIGIN}/edit/${DEMO_SLUG}`, { waitUntil: "networkidle0" });
      await page.waitForFunction(
        (slug) =>
          document.body.innerText.includes(`QR for /${slug}`) &&
          document.querySelector("canvas"),
        { timeout: 15_000 },
        DEMO_SLUG,
      );
      await screenshot(page, "frame-03-edit-qr");

      await page.goto(`${DEMO_ORIGIN}/stats`, { waitUntil: "networkidle0" });
      await page.waitForFunction(
        () =>
          document.body.innerText.includes("Public stats") &&
          document.body.innerText.includes("Group by path"),
        { timeout: 20_000 },
      );
      await screenshot(page, "frame-04-stats");

      await page.goto(`${DEMO_ORIGIN}/warn/${DEMO_SLUG}`, { waitUntil: "networkidle0" });
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
      await source.stop();
      rmSync(framesDir, { recursive: true, force: true });
    }
  }, 90_000);
});
