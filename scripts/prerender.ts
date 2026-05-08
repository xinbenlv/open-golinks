// 构建期 SSG 预渲染脚本.
// 流程:
// 1. 读取 vite 构建好的 dist/web/index.html (含资源 <script>/<link>)
// 2. 调用 src/web/entry-ssr.tsx#renderApp("/") 得到 Landing HTML 字符串
// 3. 注入到 <div id="root">...</div>, 同时补充 SEO meta
// 4. 写回 dist/web/index.html
//
// 由 `package.json` 里 build:web 调用: vite build && bun scripts/prerender.ts.
// 客户端 main.tsx 检测到 root 已有内容时调用 hydrateRoot, 完成 SSG 接管.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderApp } from "../src/web/entry-ssr.tsx";

const DIST_HTML = resolve(import.meta.dir, "..", "dist", "web", "index.html");

const META_TAGS = `
    <meta name="description" content="Open GoLinks: 开源、可自部署的 go/links 短链服务. 匿名可用, 公私可控, 内置访问统计与浏览器扩展." />
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

  // 注入 title (Vite 的 index.html 默认 title 替换)
  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${TITLE}</title>${META_TAGS}`,
  );

  // 注入 lang
  html = html.replace(/<html\b[^>]*>/, '<html lang="zh-CN">');

  // 注入主题闪烁防抖 inline script (在样式表加载前确定 data-theme)
  const themeScript = `
    <script>
      (function () {
        try {
          var t = localStorage.getItem("ogl-theme");
          if (t === "light" || t === "dark") {
            document.documentElement.setAttribute("data-theme", t);
          }
        } catch (e) {}
      })();
    </script>`;
  html = html.replace("</head>", `${themeScript}\n  </head>`);

  // 注入 SSG 渲染结果到 #root
  html = html.replace(
    /<div id="root">[\s\S]*?<\/div>/,
    `<div id="root">${body}</div>`,
  );

  await writeFile(DIST_HTML, html, "utf8");
  console.log(`[prerender] wrote ${DIST_HTML} (${html.length} bytes, body ${body.length})`);
}

main().catch((err) => {
  console.error("[prerender] failed", err);
  process.exit(1);
});
