# SPA 路由 / 静态资源被 `/:slug` 拦截

## 问题描述

在生产 (`NODE_ENV=production`) 下:
- 直接访问 `/favicon.svg` / `/robots.txt` 等带 `.` 的根路径返回 404
- 直接访问 `/dashboard` / `/edit/:slug` / `/warn/:slug` 等 SPA 路由返回 404 (而非由 `dist/web/index.html` 接管)

只有 `/` 工作正常, 因为 `/` 不匹配 `/:slug`.

## 错误原因

`src/server.ts:22` 注册 `app.route("/", redirectRoute)`, 而 `src/routes/redirect.ts:24-30` 的 `GET /:slug` handler 行为:

```ts
if (RESERVED.has(slug) || !SLUG_RE.test(slug)) {
  return c.notFound();
}
```

- RESERVED 集合包含 `dashboard` / `edit` / `warn` / `favicon.ico` / `robots.txt` 等
- SLUG_RE = `^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$`, 不允许 `.`, 所以 `favicon.svg` 也被拒
- `c.notFound()` 终止响应链, 后续 `app.use("/*", serveStatic(...))` 与 `app.get("*", serveStatic({ path: "./dist/web/index.html" }))` 都不会执行

## 当前缓解 (本计划范围内)

Landing 计划禁止改 `src/server.ts` / `src/routes/`, 因此:

- favicon 改用 inline `data:image/svg+xml;...` URL, 写在 `src/web/index.html`, 不依赖后端
- SPA 其他路径 (Dashboard 等) 当前是 stub, 留作后续 server 改造

## 后续修复方向 (server 改造时一起做)

让 `redirect.ts` 的 RESERVED / 非 slug 路径 **fall through 到下一个 handler**, 而不是直接 `c.notFound()`:

```ts
// 伪代码
import type { Next } from "hono";

redirectRoute.get("/:slug", async (c, next: Next) => {
  const slug = c.req.param("slug");
  if (RESERVED.has(slug) || !SLUG_RE.test(slug)) {
    await next();           // 让 serveStatic / SPA fallback 接管
    return;
  }
  // ... 原有 DB 查询逻辑, 命中失败时也 await next()
});
```

这样:
- `/favicon.svg` → fall through → `serveStatic` 命中 `dist/web/favicon.svg`
- `/dashboard` → fall through → `serveStatic` 没匹配 → `app.get("*", ...)` 返回 `dist/web/index.html` → SPA 接管路由
- 真正不存在的 slug `/zzz999` → fall through → 同上 → SPA `NotFound` 页处理

## 相关代码

- `src/server.ts:10-28`
- `src/routes/redirect.ts:24-30`
- `src/web/index.html` (inline favicon data URL)
- `src/web/main.tsx:13-30` (hydrate vs createRoot 智能切换)
