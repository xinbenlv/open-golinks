// 构建期 SSG 预渲染脚本.
// 流程:
// 1. 从 src/build-info.ts 读取 BUILD_INFO 四元组 (version/sha/builtAt/branch), 注入 globalThis
// 2. 读 vite 构建好的 dist/web/index.html (含资源 <script>/<link>)
// 3. 调 src/web/entry-ssr.tsx#renderApp("/") 得到 Landing HTML 字符串 (BuildStamp/Footer 此时读 globalThis)
// 4. 拼装最终 HTML: 注入 SEO meta + 主题闪烁防抖脚本 + 客户端版本注入 inline script + 渲染结果
// 5. 写回 dist/web/index.html
//
// 由 package.json 里 build:web 调用: vite build && bun scripts/prerender.ts.
// 客户端 main.tsx 检测到 root 已有内容时调用 hydrateRoot, 完成 SSG 接管.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { BUILD_INFO, formatBuildLine } from "../src/build-info.ts";
import { getBrandConfig } from "../src/lib/brand.ts";

const ROOT = resolve(import.meta.dir, "..");
const DIST_HTML = resolve(ROOT, "dist", "web", "index.html");

const VERSION_PAYLOAD = {
  version: BUILD_INFO.version,
  sha: BUILD_INFO.sha,
  builtAt: BUILD_INFO.builtAt,
  branch: BUILD_INFO.branch,
};
const BRAND = getBrandConfig(process.env.OPEN_GOLINK_THEME);

// 给 SSG render 用 (BuildStamp / Footer 在 render 期读 globalThis)
globalThis.__OGL_VERSION__ = VERSION_PAYLOAD;

const { renderApp } = await import("../src/web/entry-ssr.tsx");

const META_TAGS = `
    <meta name="description" content="${BRAND.instanceDescription}" />
    <meta name="x-version" content="v${BUILD_INFO.version} · ${BUILD_INFO.sha} · ${BUILD_INFO.builtAt}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${BRAND.productName} · ${BRAND.shortDescription}" />
    <meta property="og:description" content="${BRAND.instanceDescription}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${BRAND.productName} · ${BRAND.shortDescription}" />
    <meta name="twitter:description" content="${BRAND.instanceDescription}" />
    <meta name="theme-color" content="#0a0a0c" media="(prefers-color-scheme: dark)" />
    <meta name="theme-color" content="#fafaf7" media="(prefers-color-scheme: light)" />`;

const TITLE = `${BRAND.productName} · ${BRAND.shortDescription}`;

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
  html = html.replace(/<html\b[^>]*>/, `<html lang="zh-CN" data-brand="${BRAND.theme}">`);

  // 主题闪烁防抖 + 客户端版本注入 (在 main.tsx 之前跑, 让 hydrate 阶段 BuildStamp 也读到同一份)
  const headScripts = `
    <script>
      (function () {
        try {
          document.documentElement.dataset.brand = ${JSON.stringify(BRAND.theme)};
          var t = localStorage.getItem("ogl-theme");
          if (t === "light" || t === "dark") {
            document.documentElement.setAttribute("data-theme", t);
          }
        } catch (e) {}
        window.__OGL_VERSION__ = ${JSON.stringify(VERSION_PAYLOAD)};
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
    `[prerender] ${formatBuildLine()} wrote ${DIST_HTML} (${html.length} bytes, body ${body.length})`,
  );
}

main().catch((err) => {
  console.error("[prerender] failed", err);
  process.exit(1);
});
