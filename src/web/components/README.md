# components/

跨页面复用的轻量展示型组件 (与具体页面/路由无关).

## 文件

- `AuthGuard.tsx` — 保护 owner-only SPA 路由. loading 时显示轻量 spinner; 未登录时跳 `/login`, 并保留原始 location.
- `BuildStamp.tsx` — 全局右下角的构建版本水印 (version · sha · 时间). 在 `App.tsx` 顶层挂载, 所有路由可见. 样式见 `../styles/global.css` 的 `.build-stamp` class. 数据来源: `../version.ts` (由 `scripts/prerender.ts` 构建期注入 `globalThis.__OGL_VERSION__`).
