// 构建期 SSG 预渲染脚本.
// 流程:
// 1. 读 git short SHA + 当前日期, 注入到 globalThis.__OGL_VERSION__
// 2. 读 vite 构建好的 dist/web/index.html (含资源 <script>/<link>)
// 3. 调 src/web/entry-ssr.tsx#renderApp("/") 得到 Landing HTML 字符串 (Footer 此时读 globalThis)
// 4. 拼装最终 HTML: 注入 SEO meta + 主题闪烁防抖脚本 + 客户端版本注入 inline script + 渲染结果
// 5. 写回 dist/web/index.html
//
// 由 package.json 里 build:web 调用: vite build && bun scripts/prerender.ts.
// 客户端 main.tsx 检测到 root 已有内容时调用 hydrateRoot, 完成 SSG 接管.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const ROOT = resolve(import.meta.dir, "..");
const DIST_HTML = resolve(ROOT, "dist", "web", "index.html");

function readGitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

const SHA = process.env.OGL_SHA || readGitSha();
const BUILD_TIME = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// 给 SSG render 用 (Footer 在 render 期读 globalThis)
globalThis.__OGL_VERSION__ = { sha: SHA, buildTime: BUILD_TIME };

// 静态 import 必须在 globalThis 注入之后吗? 不必 — Footer 在函数体内读 globalThis,
// 函数调用时 (renderApp 调用时) 才求值. 但放在这里再 import 仍然语义清晰.
const { renderApp } = await import("../src/web/entry-ssr.tsx");

const META_TAGS = `
    <meta name="description" content="Open GoLinks: 开源、可自部署的 go/links 短链服务. 匿名可用, 公私可控, 内置访问统计与浏览器扩展." />
    <meta name="x-version" content="${SHA} · ${BUILD_TIME}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Open GoLinks · 开源 go/links 短链服务" />
    <meta property="og:description" content="一个语义化的链接, 共享给整个团队. 开源、自部署、克制设计." />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Open GoLinks · 开源 go/links 短链服务" />
    <meta name="twitter:description" content="一个语义化的链接, 共享给整个团队. 开源、自部署、克制设计." />
    <meta name="theme-color" content="#0a0a0c" media="(prefers-color-scheme: dark)" />
    <meta name="theme-color" content="#fafaf7" media="(prefers-color-scheme: light)" />`;

const TITLE = "Open GoLinks · 开源 go/links 短链服务";

async function main() {
  const tpl = await readFile(DIST_HTML, "utf8");
  const body = renderApp("/");

  let html = tpl;

  // 注入 title + meta (Vite 默认 <title> 替换)
  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${TITLE}</title>${META_TAGS}`,
  );

  // 注入 lang
  html = html.replace(/<html\b[^>]*>/, '<html lang="zh-CN">');

  // 主题闪烁防抖 + 客户端版本注入 (在 main.tsx 之前跑, 让 hydrate 阶段 Footer 也读到同一份)
  const headScripts = `
    <script>
      (function () {
        try {
          var t = localStorage.getItem("ogl-theme");
          if (t === "light" || t === "dark") {
            document.documentElement.setAttribute("data-theme", t);
          }
        } catch (e) {}
        window.__OGL_VERSION__ = ${JSON.stringify({ sha: SHA, buildTime: BUILD_TIME })};
      })();
    </script>`;
  html = html.replace("</head>", `${headScripts}\n  </head>`);

  // 注入 SSG 渲染结果到 #root
  html = html.replace(
    /<div id="root">[\s\S]*?<\/div>/,
    `<div id="root">${body}</div>`,
  );

  await writeFile(DIST_HTML, html, "utf8");
  console.log(
    `[prerender] sha=${SHA} build=${BUILD_TIME} wrote ${DIST_HTML} (${html.length} bytes, body ${body.length})`,
  );
}

main().catch((err) => {
  console.error("[prerender] failed", err);
  process.exit(1);
});
